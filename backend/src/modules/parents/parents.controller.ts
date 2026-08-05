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
  CreateParentDto,
  LinkStudentDto,
  ListParentsDto,
  ParentResponseDto,
  UpdateLinkDto,
  UpdateParentDto,
} from './dto';
import { type Actor, ParentsService } from './parents.service';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
  permissions: user.permissions ?? [],
});

@ApiTags('Parents')
@ApiBearerAuth('access-token')
@Controller({ path: 'parents', version: '1' })
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.parent.read)
  @ApiOperation({
    summary: "List this school's guardians",
    description:
      'Paged and scoped to the caller’s school. `search` matches the guardian’s name, email, ' +
      'phone, and occupation — and also their children’s names and admission numbers, which is ' +
      'how the office usually looks someone up.',
  })
  @ApiPaginatedResponse(ParentResponseDto)
  findAll(
    @Query() query: ListParentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<ParentResponseDto>> {
    return this.parents.findAll(query, actorOf(user));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.parent.read)
  @ApiOperation({ summary: 'Fetch a single guardian, with their students' })
  @ApiOkResponse({ type: ParentResponseDto })
  @ApiNotFoundResponse({ description: 'No such guardian' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ParentResponseDto> {
    return this.parents.findOne(id, actorOf(user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.parent.create)
  @ApiOperation({
    summary: 'Record a guardian',
    description:
      'Send `userId` to make an existing account a guardian, or email/name/password to create ' +
      'one. The account path applies the same rules as POST /users.',
  })
  @ApiCreatedResponse({ type: ParentResponseDto })
  @ApiBadRequestResponse({ description: 'Neither userId nor account details supplied' })
  @ApiConflictResponse({ description: 'Already a guardian' })
  create(
    @Body() dto: CreateParentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ParentResponseDto> {
    return this.parents.create(dto, actorOf(user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.parent.update)
  @ApiOperation({
    summary: 'Edit the guardian record, contact details, and address',
    description:
      'Email, status, and roles are not editable here — each is a privileged action with its ' +
      'own endpoint under /users.',
  })
  @ApiOkResponse({ type: ParentResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ParentResponseDto> {
    return this.parents.update(id, dto, actorOf(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.parent.delete)
  @ApiOperation({
    summary: 'Remove a guardian record',
    description:
      'Deletes the guardian record only — the user account and its sign-in survive. Refused ' +
      'while any student is still linked, since deleting would detach them silently.',
  })
  @ApiNoContentResponse({ description: 'Guardian record removed' })
  @ApiConflictResponse({ description: 'Students still linked' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.parents.remove(id, actorOf(user));
  }

  // -------------------------------------------------------------------------
  // Student relationships
  // -------------------------------------------------------------------------

  // 200, not the 201 Nest gives a POST by default: the response is the updated
  // guardian, and callers read it back rather than following a Location header.
  @Post(':id/students')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.parent.update)
  @ApiOperation({
    summary: 'Link a student to this guardian',
    description:
      'Marking this guardian as primary contact demotes whoever previously held it for that ' +
      'student — a student has at most one.',
  })
  @ApiOkResponse({ type: ParentResponseDto })
  @ApiConflictResponse({ description: 'Already linked' })
  @ApiNotFoundResponse({ description: 'No such student in this school' })
  linkStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ParentResponseDto> {
    return this.parents.linkStudent(id, dto, actorOf(user));
  }

  @Patch(':id/students/:studentId')
  @RequirePermissions(PERMISSIONS.parent.update)
  @ApiOperation({ summary: 'Change the relationship, or who is primary contact' })
  @ApiOkResponse({ type: ParentResponseDto })
  @ApiNotFoundResponse({ description: 'Not linked to this guardian' })
  updateLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: UpdateLinkDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ParentResponseDto> {
    return this.parents.updateLink(id, studentId, dto, actorOf(user));
  }

  @Delete(':id/students/:studentId')
  @RequirePermissions(PERMISSIONS.parent.update)
  @ApiOperation({ summary: 'Unlink a student from this guardian' })
  @ApiOkResponse({ type: ParentResponseDto })
  @ApiNotFoundResponse({ description: 'Not linked to this guardian' })
  unlinkStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ParentResponseDto> {
    return this.parents.unlinkStudent(id, studentId, actorOf(user));
  }
}
