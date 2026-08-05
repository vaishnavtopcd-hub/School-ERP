import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '@/common/constants';
import { ApiPaginatedResponse, CurrentUser, RequirePermissions } from '@/common/decorators';
import { type AuthenticatedUser, type PaginatedResult } from '@/common/types';

import { type Actor, AcademicYearsService } from './academic-years.service';
import {
  AcademicYearResponseDto,
  ActivateAcademicYearResponseDto,
  CreateAcademicYearDto,
  ListAcademicYearsDto,
  UpdateAcademicYearDto,
} from './dto';

const actorOf = (user: AuthenticatedUser): Actor => ({ id: user.id, schoolId: user.schoolId });

@ApiTags('Academic Years')
@ApiBearerAuth('access-token')
@Controller({ path: 'academic-years', version: '1' })
export class AcademicYearsController {
  constructor(private readonly academicYears: AcademicYearsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.academicYear.read)
  @ApiOperation({
    summary: 'List academic years',
    description: 'Paginated, searchable by name, filterable by status.',
  })
  @ApiPaginatedResponse(AcademicYearResponseDto)
  findAll(
    @Query() query: ListAcademicYearsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PaginatedResult<AcademicYearResponseDto>> {
    return this.academicYears.findAll(query, actorOf(actor));
  }

  @Get('active')
  @RequirePermissions(PERMISSIONS.academicYear.read)
  @ApiOperation({
    summary: "The school's current active year",
    description: 'Returns null when no year has been activated yet.',
  })
  @ApiQuery({ name: 'schoolId', required: false, format: 'uuid' })
  @ApiOkResponse({ type: AcademicYearResponseDto, nullable: true })
  findActive(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('schoolId') schoolId?: string,
  ): Promise<AcademicYearResponseDto | null> {
    return this.academicYears.findActive(actorOf(actor), schoolId);
  }

  // Declared after `active` so the literal segment is not captured as an :id.
  @Get(':id')
  @RequirePermissions(PERMISSIONS.academicYear.read)
  @ApiOperation({ summary: 'Fetch a single academic year' })
  @ApiOkResponse({ type: AcademicYearResponseDto })
  @ApiNotFoundResponse({ description: 'No such academic year' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AcademicYearResponseDto> {
    return this.academicYears.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.academicYear.create)
  @ApiOperation({
    summary: 'Create an academic year',
    description:
      'Always created as UPCOMING. Dates must not overlap an existing year for the same school.',
  })
  @ApiCreatedResponse({ type: AcademicYearResponseDto })
  @ApiConflictResponse({ description: 'Name already used, or dates overlap another year' })
  create(
    @Body() dto: CreateAcademicYearDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AcademicYearResponseDto> {
    return this.academicYears.create(dto, actorOf(actor));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.academicYear.update)
  @ApiOperation({
    summary: 'Edit an academic year',
    description: 'Name and dates only. Archived years are read-only.',
  })
  @ApiOkResponse({ type: AcademicYearResponseDto })
  @ApiConflictResponse({ description: 'Archived, name taken, or dates overlap another year' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicYearDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AcademicYearResponseDto> {
    return this.academicYears.update(id, dto, actorOf(actor));
  }

  @Patch(':id/activate')
  @RequirePermissions(PERMISSIONS.academicYear.activate)
  @ApiOperation({
    summary: 'Make this the active academic year',
    description:
      'Archives whichever year was previously active, atomically. A school therefore never has ' +
      'two active years, nor a gap with none. Archived years cannot be reactivated.',
  })
  @ApiOkResponse({ type: ActivateAcademicYearResponseDto })
  @ApiConflictResponse({ description: 'Already active, archived, or lost an activation race' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ActivateAcademicYearResponseDto> {
    return this.academicYears.activate(id, actorOf(actor));
  }

  @Patch(':id/archive')
  @RequirePermissions(PERMISSIONS.academicYear.archive)
  @ApiOperation({
    summary: 'Archive an academic year',
    description: 'Terminal: an archived year becomes read-only and cannot be reactivated.',
  })
  @ApiOkResponse({ type: AcademicYearResponseDto })
  @ApiConflictResponse({ description: 'Already archived' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AcademicYearResponseDto> {
    return this.academicYears.archive(id, actorOf(actor));
  }
}
