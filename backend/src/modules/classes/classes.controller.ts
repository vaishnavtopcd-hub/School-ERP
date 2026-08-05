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
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '@/common/constants';
import { ApiPaginatedResponse, CurrentUser, RequirePermissions } from '@/common/decorators';
import { type AuthenticatedUser, type PaginatedResult } from '@/common/types';

import { type Actor, ClassesService } from './classes.service';
import {
  ClassResponseDto,
  CreateClassDto,
  CreateSectionDto,
  EligibleTeacherDto,
  ListClassesDto,
  SectionResponseDto,
  UpdateClassDto,
  UpdateSectionDto,
} from './dto';

const actorOf = (user: AuthenticatedUser): Actor => ({ id: user.id, schoolId: user.schoolId });

@ApiTags('Classes')
@ApiBearerAuth('access-token')
@Controller({ path: 'classes', version: '1' })
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  // --- Classes -------------------------------------------------------------

  @Get()
  @RequirePermissions(PERMISSIONS.schoolClass.read)
  @ApiOperation({
    summary: 'List classes with their sections',
    description: "Scoped to the school's active academic year unless academicYearId is supplied.",
  })
  @ApiPaginatedResponse(ClassResponseDto)
  findAll(
    @Query() query: ListClassesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PaginatedResult<ClassResponseDto>> {
    return this.classes.findAll(query, actorOf(actor));
  }

  @Get('teachers')
  @RequirePermissions(PERMISSIONS.schoolClass.read)
  @ApiOperation({
    summary: 'Teachers eligible to be a class teacher',
    description: 'Each is flagged with whether they already hold a section this year.',
  })
  @ApiQuery({ name: 'academicYearId', required: false, format: 'uuid' })
  @ApiOkResponse({ type: EligibleTeacherDto, isArray: true })
  listTeachers(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('academicYearId') academicYearId?: string,
  ): Promise<EligibleTeacherDto[]> {
    return this.classes.listEligibleTeachers(academicYearId, actorOf(actor));
  }

  // Declared after `teachers` so the literal segment is not captured as an :id.
  @Get(':id')
  @RequirePermissions(PERMISSIONS.schoolClass.read)
  @ApiOperation({ summary: 'Fetch a single class' })
  @ApiOkResponse({ type: ClassResponseDto })
  @ApiNotFoundResponse({ description: 'No such class' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ClassResponseDto> {
    return this.classes.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.schoolClass.create)
  @ApiOperation({ summary: 'Create a class' })
  @ApiCreatedResponse({ type: ClassResponseDto })
  @ApiConflictResponse({ description: 'Name already used in this year, or the year is archived' })
  create(
    @Body() dto: CreateClassDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ClassResponseDto> {
    return this.classes.createClass(dto, actorOf(actor));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.schoolClass.update)
  @ApiOperation({ summary: 'Edit a class, including its active status' })
  @ApiOkResponse({ type: ClassResponseDto })
  @ApiConflictResponse({ description: 'Name already used, or the year is archived' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ClassResponseDto> {
    return this.classes.updateClass(id, dto, actorOf(actor));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.schoolClass.delete)
  @ApiOperation({
    summary: 'Delete a class',
    description: 'Removes its sections as well. Deactivate instead to keep the record.',
  })
  @ApiNoContentResponse({ description: 'Class deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.classes.removeClass(id, actorOf(actor));
  }

  // --- Sections ------------------------------------------------------------

  @Post(':id/sections')
  @RequirePermissions(PERMISSIONS.schoolClass.create)
  @ApiOperation({ summary: 'Add a section to a class' })
  @ApiCreatedResponse({ type: SectionResponseDto })
  @ApiConflictResponse({ description: 'Section name taken, or the teacher already holds one' })
  createSection(
    @Param('id', ParseUUIDPipe) classId: string,
    @Body() dto: CreateSectionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<SectionResponseDto> {
    return this.classes.createSection(classId, dto, actorOf(actor));
  }

  @Patch('sections/:sectionId')
  @RequirePermissions(PERMISSIONS.schoolClass.update)
  @ApiOperation({
    summary: 'Edit a section',
    description: 'Send classTeacherId as null to unassign the current class teacher.',
  })
  @ApiOkResponse({ type: SectionResponseDto })
  @ApiConflictResponse({ description: 'Section name taken, or the teacher already holds one' })
  updateSection(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: UpdateSectionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<SectionResponseDto> {
    return this.classes.updateSection(sectionId, dto, actorOf(actor));
  }

  @Delete('sections/:sectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.schoolClass.delete)
  @ApiOperation({ summary: 'Delete a section' })
  @ApiNoContentResponse({ description: 'Section deleted' })
  async removeSection(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.classes.removeSection(sectionId, actorOf(actor));
  }
}
