import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { SystemRoleKey } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '@/common/constants';
import {
  ApiPaginatedResponse,
  CurrentUser,
  RequirePermissions,
  RequireSystemRole,
} from '@/common/decorators';
import { type PaginatedResult } from '@/common/types';
import { type UserResponseDto } from '@/modules/users/dto';

import {
  CreateSchoolAdminDto,
  CreateSchoolDto,
  ListSchoolsDto,
  SchoolResponseDto,
  UpdateSchoolDto,
} from './dto';
import { SchoolsService } from './schools.service';

@ApiTags('Schools')
@ApiBearerAuth('access-token')
@Controller({ path: 'schools', version: '1' })
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get()
  @RequireSystemRole(SystemRoleKey.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List schools',
    description: 'Platform operator only — every other account sees just its own school.',
  })
  @ApiPaginatedResponse(SchoolResponseDto)
  findAll(@Query() query: ListSchoolsDto): Promise<PaginatedResult<SchoolResponseDto>> {
    return this.schools.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.school.read)
  @ApiOperation({ summary: 'Fetch a single school' })
  @ApiOkResponse({ type: SchoolResponseDto })
  @ApiNotFoundResponse({ description: 'No such school' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SchoolResponseDto> {
    return this.schools.findOne(id);
  }

  @Post()
  @RequireSystemRole(SystemRoleKey.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a school',
    description:
      "Provisions the school's starting role set in the same transaction, including its locked Administrator role.",
  })
  @ApiCreatedResponse({ type: SchoolResponseDto })
  @ApiConflictResponse({ description: 'Code already in use' })
  @ApiForbiddenResponse({ description: 'Platform operator only' })
  create(
    @Body() dto: CreateSchoolDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SchoolResponseDto> {
    return this.schools.create(dto, actorId);
  }

  @Post(':id/admin')
  @RequireSystemRole(SystemRoleKey.SUPER_ADMIN)
  @ApiOperation({
    summary: "Appoint the school's administrator",
    description:
      "Creates an account holding the school's Administrator role. This is the only way that role is granted.",
  })
  @ApiCreatedResponse({ description: 'Administrator appointed' })
  @ApiConflictResponse({ description: 'Email already in use' })
  @ApiForbiddenResponse({ description: 'Platform operator only' })
  createAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSchoolAdminDto,
    @CurrentUser('id') actorId: string,
  ): Promise<UserResponseDto> {
    return this.schools.createAdmin(id, dto, actorId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.school.update)
  @ApiOperation({ summary: 'Update school details' })
  @ApiOkResponse({ type: SchoolResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchoolDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SchoolResponseDto> {
    return this.schools.update(id, dto, actorId);
  }

  @Patch(':id/deactivate')
  @RequireSystemRole(SystemRoleKey.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Deactivate a school',
    description:
      'Reversible. Deliberately not a delete — that would cascade to every user, role, year, and class the school owns.',
  })
  @ApiOkResponse({ type: SchoolResponseDto })
  @ApiConflictResponse({ description: 'Already inactive' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<SchoolResponseDto> {
    return this.schools.deactivate(id, actorId);
  }
}
