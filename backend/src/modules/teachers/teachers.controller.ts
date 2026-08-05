import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SystemRoleKey } from '@prisma/client';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '@/common/constants';
import { ApiPaginatedResponse, CurrentUser, RequirePermissions } from '@/common/decorators';
import { type AuthenticatedUser, type PaginatedResult } from '@/common/types';

import {
  AllocateSectionDto,
  AllocateSubjectDto,
  CreateTeacherDto,
  ListTeachersDto,
  TeacherResponseDto,
  UpdateTeacherDto,
} from './dto';
import { type Actor, TeachersService } from './teachers.service';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
  permissions: user.permissions ?? [],
});

/**
 * Staff records. Every route requires `teacher:*`, which is granted only to a
 * school's Administrator and Manager — teaching and academic roles deliberately
 * do not hold it.
 */
@ApiTags('Teachers')
@ApiBearerAuth('access-token')
@Controller({ path: 'teachers', version: '1' })
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.teacher.read)
  @ApiOperation({
    summary: "List this school's teaching staff",
    description:
      'Driven by **role**: anyone whose role grants class access appears, whether or not they ' +
      'have an employment record yet — those read as empty until first saved. Narrow to one ' +
      'role with `roleId`. Paged and scoped to the caller’s school; `search` matches name, ' +
      'email, employee code, qualification, and specialisation.',
  })
  @ApiPaginatedResponse(TeacherResponseDto)
  findAll(
    @Query() query: ListTeachersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<TeacherResponseDto>> {
    return this.teachers.findAll(query, actorOf(user));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.teacher.read)
  @ApiOperation({ summary: 'Fetch a single teacher, with their allocations' })
  @ApiOkResponse({ type: TeacherResponseDto })
  @ApiNotFoundResponse({ description: 'No such teacher' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeacherResponseDto> {
    return this.teachers.findOne(id, actorOf(user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.teacher.create)
  @ApiOperation({
    summary: 'Take on a teacher who has no account yet',
    description:
      'Only needed for a new member of staff — anyone who already holds a teaching role is in ' +
      'the list already, and PATCHing them creates their employment record. Send `userId` to ' +
      'give an existing account a record, or email/name/password to create the account too; ' +
      'the latter applies the same rules as POST /users.',
  })
  @ApiCreatedResponse({ type: TeacherResponseDto })
  @ApiBadRequestResponse({ description: 'Neither userId nor account details supplied' })
  @ApiConflictResponse({ description: 'Already a teacher, or employee code in use' })
  create(
    @Body() dto: CreateTeacherDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeacherResponseDto> {
    return this.teachers.create(dto, actorOf(user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.teacher.update)
  @ApiOperation({
    summary: 'Edit the employment record and contact details',
    description:
      'Creates the employment record if the user has none, which is how someone listed purely ' +
      'on their role becomes staff. Email, status, and roles are not editable here — each is a ' +
      'privileged action with its own endpoint under /users.',
  })
  @ApiOkResponse({ type: TeacherResponseDto })
  @ApiConflictResponse({ description: 'Employee code in use' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeacherResponseDto> {
    return this.teachers.update(id, dto, actorOf(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.teacher.delete)
  @ApiOperation({
    summary: 'Remove someone from teaching staff',
    description:
      'Deletes the employment record only — the user account and its sign-in survive, so ' +
      'someone still holding a teaching role stays in the list with empty details. Refused ' +
      'while any subject or section is still allocated.',
  })
  @ApiNoContentResponse({ description: 'Teacher record removed' })
  @ApiConflictResponse({ description: 'Still allocated to subjects or sections' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.teachers.remove(id, actorOf(user));
  }

  // -------------------------------------------------------------------------
  // Allocation
  // -------------------------------------------------------------------------

  // 200, not the 201 Nest gives a POST by default: this creates nothing, it
  // sets a field on an existing subject and answers with the updated teacher.
  @Post(':id/subjects')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.teacher.update)
  @ApiOperation({
    summary: 'Allocate a subject to this teacher',
    description: 'Replaces whoever previously taught it — a subject has one teacher.',
  })
  @ApiOkResponse({ type: TeacherResponseDto })
  allocateSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeacherResponseDto> {
    return this.teachers.allocateSubject(id, dto.subjectId, actorOf(user));
  }

  @Delete(':id/subjects/:subjectId')
  @RequirePermissions(PERMISSIONS.teacher.update)
  @ApiOperation({ summary: 'Unassign a subject from this teacher' })
  @ApiOkResponse({ type: TeacherResponseDto })
  @ApiNotFoundResponse({ description: 'Not allocated to this teacher' })
  deallocateSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeacherResponseDto> {
    return this.teachers.deallocateSubject(id, subjectId, actorOf(user));
  }

  @Post(':id/sections')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.teacher.update)
  @ApiOperation({
    summary: 'Make this teacher the class teacher of a section',
    description:
      'Subject to the classes module’s rules: the teacher must be active, hold a teaching ' +
      'role, and not already have a section this academic year.',
  })
  @ApiOkResponse({ type: TeacherResponseDto })
  @ApiConflictResponse({ description: 'Already class teacher of another section this year' })
  allocateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeacherResponseDto> {
    return this.teachers.allocateSection(id, dto.sectionId, actorOf(user));
  }

  @Delete(':id/sections/:sectionId')
  @RequirePermissions(PERMISSIONS.teacher.update)
  @ApiOperation({ summary: 'Remove this teacher as class teacher of a section' })
  @ApiOkResponse({ type: TeacherResponseDto })
  @ApiNotFoundResponse({ description: 'Not allocated to this teacher' })
  deallocateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeacherResponseDto> {
    return this.teachers.deallocateSection(id, sectionId, actorOf(user));
  }
}
