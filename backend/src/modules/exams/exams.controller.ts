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
  CreateExamDto,
  CreateExamPaperDto,
  ExamResponseDto,
  ListExamsDto,
  UpdateExamDto,
  UpdateExamPaperDto,
} from './dto';
import { type Actor, ExamsService } from './exams.service';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
});

@ApiTags('Exams')
@ApiBearerAuth('access-token')
@Controller({ path: 'exams', version: '1' })
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.exam.read)
  @ApiOperation({
    summary: "List this school's exams",
    description:
      'Paged and scoped to the caller’s school. Filter by `status` to separate what is being ' +
      'planned from what has been announced.',
  })
  @ApiPaginatedResponse(ExamResponseDto)
  findAll(
    @Query() query: ListExamsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<ExamResponseDto>> {
    return this.exams.findAll(query, actorOf(user));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.exam.read)
  @ApiOperation({ summary: 'Fetch one exam, with its schedule' })
  @ApiOkResponse({ type: ExamResponseDto })
  @ApiNotFoundResponse({ description: 'No such exam' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.exams.findOne(id, actorOf(user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.exam.create)
  @ApiOperation({
    summary: 'Set an exam',
    description:
      'Starts as a draft with an empty schedule. The academic year defaults to the class’s own, ' +
      'then to the school’s active one.',
  })
  @ApiCreatedResponse({ type: ExamResponseDto })
  @ApiConflictResponse({ description: 'That class already has an exam of this name' })
  create(
    @Body() dto: CreateExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.exams.create(dto, actorOf(user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.exam.update)
  @ApiOperation({
    summary: 'Edit a draft exam',
    description: 'Refused once announced — publishing freezes the exam and its schedule.',
  })
  @ApiOkResponse({ type: ExamResponseDto })
  @ApiConflictResponse({ description: 'Already published or archived' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.exams.update(id, dto, actorOf(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.exam.delete)
  @ApiOperation({
    summary: 'Delete a draft exam',
    description:
      'For a draft that should never have existed. Anything the school has been told about is ' +
      'archived instead, so the record survives.',
  })
  @ApiNoContentResponse({ description: 'Draft deleted' })
  @ApiConflictResponse({ description: 'Published or archived — archive it instead' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.exams.remove(id, actorOf(user));
  }

  // --- Lifecycle -----------------------------------------------------------

  // 200 rather than 201: these return the same exam in a new state, and the
  // caller reads it back rather than following a Location header.
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.exam.publish)
  @ApiOperation({
    summary: 'Announce the exam',
    description:
      'Makes it visible to teaching staff and on a student’s profile, and freezes the schedule. ' +
      'Refused while nothing is scheduled — an empty announcement tells the school nothing.',
  })
  @ApiOkResponse({ type: ExamResponseDto })
  @ApiBadRequestResponse({ description: 'No papers scheduled' })
  @ApiConflictResponse({ description: 'Already published, or archived' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.exams.publish(id, actorOf(user));
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.exam.archive)
  @ApiOperation({
    summary: 'Close the exam for good',
    description: 'Terminal — an archived exam cannot be reopened, only superseded by a new one.',
  })
  @ApiOkResponse({ type: ExamResponseDto })
  @ApiConflictResponse({ description: 'Already archived' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.exams.archive(id, actorOf(user));
  }

  // --- Schedule ------------------------------------------------------------

  @Post(':id/papers')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.exam.update)
  @ApiOperation({
    summary: 'Schedule a paper',
    description:
      'The subject must belong to the exam’s class, and each subject is examined once per exam. ' +
      'Returns the exam with its updated schedule.',
  })
  @ApiOkResponse({ type: ExamResponseDto })
  @ApiBadRequestResponse({
    description: 'Subject from another class, or times/marks that do not add up',
  })
  @ApiConflictResponse({
    description: 'That subject is already scheduled, or the exam is not a draft',
  })
  addPaper(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateExamPaperDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.exams.addPaper(id, dto, actorOf(user));
  }

  @Patch(':id/papers/:paperId')
  @RequirePermissions(PERMISSIONS.exam.update)
  @ApiOperation({ summary: 'Change a scheduled paper' })
  @ApiOkResponse({ type: ExamResponseDto })
  @ApiNotFoundResponse({ description: 'That paper is not on this exam' })
  updatePaper(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paperId', ParseUUIDPipe) paperId: string,
    @Body() dto: UpdateExamPaperDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.exams.updatePaper(id, paperId, dto, actorOf(user));
  }

  @Delete(':id/papers/:paperId')
  @RequirePermissions(PERMISSIONS.exam.update)
  @ApiOperation({ summary: 'Remove a paper from the schedule' })
  @ApiOkResponse({ type: ExamResponseDto })
  @ApiNotFoundResponse({ description: 'That paper is not on this exam' })
  removePaper(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paperId', ParseUUIDPipe) paperId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.exams.removePaper(id, paperId, actorOf(user));
  }
}
