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
  CreateSubjectDto,
  ListSubjectsDto,
  SubjectResponseDto,
  UpdateSubjectDto,
} from './dto';
import { type Actor, SubjectsService } from './subjects.service';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
});

@ApiTags('Subjects')
@ApiBearerAuth('access-token')
@Controller({ path: 'subjects', version: '1' })
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.subject.read)
  @ApiOperation({
    summary: "List this school's subjects",
    description:
      'Paged and scoped to the caller’s school. `search` matches subject code, subject name, ' +
      'and class name.',
  })
  @ApiPaginatedResponse(SubjectResponseDto)
  findAll(
    @Query() query: ListSubjectsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<SubjectResponseDto>> {
    return this.subjects.findAll(query, actorOf(user));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.subject.read)
  @ApiOperation({ summary: 'Fetch a single subject' })
  @ApiOkResponse({ type: SubjectResponseDto })
  @ApiNotFoundResponse({ description: 'No such subject' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubjectResponseDto> {
    return this.subjects.findOne(id, actorOf(user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.subject.create)
  @ApiOperation({
    summary: 'Add a subject to a class',
    description: 'Code and name must each be unused within the target class.',
  })
  @ApiCreatedResponse({ type: SubjectResponseDto })
  @ApiBadRequestResponse({ description: 'Teacher belongs to another school' })
  @ApiConflictResponse({ description: 'Code or name already used in that class' })
  @ApiNotFoundResponse({ description: 'No such class' })
  create(
    @Body() dto: CreateSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubjectResponseDto> {
    return this.subjects.create(dto, actorOf(user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.subject.update)
  @ApiOperation({
    summary: 'Edit a subject, or reassign its class or teacher',
    description: 'Send `teacherId: null` to leave the subject unassigned.',
  })
  @ApiOkResponse({ type: SubjectResponseDto })
  @ApiConflictResponse({ description: 'Code or name already used in the target class' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubjectResponseDto> {
    return this.subjects.update(id, dto, actorOf(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.subject.delete)
  @ApiOperation({
    summary: 'Delete a subject',
    description: 'Deactivate instead to retire one whose history is worth keeping.',
  })
  @ApiNoContentResponse({ description: 'Subject deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.subjects.remove(id, actorOf(user));
  }
}
