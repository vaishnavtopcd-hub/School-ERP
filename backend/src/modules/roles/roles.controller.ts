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
} from '@nestjs/common';
import { SystemRoleKey } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '@/common/constants';
import { CurrentUser, RequirePermissions } from '@/common/decorators';
import { type AuthenticatedUser } from '@/common/types';

import {
  CreateRoleDto,
  PermissionOptionDto,
  RoleResponseDto,
  UpdateRoleDto,
} from './dto';
import { type Actor, RolesService } from './roles.service';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
  permissions: user.permissions,
});

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.role.read)
  @ApiOperation({
    summary: "List this school's roles",
    description: 'Scoped to the caller’s school. Includes the locked system roles.',
  })
  @ApiOkResponse({ type: RoleResponseDto, isArray: true })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<RoleResponseDto[]> {
    return this.roles.findAll(actorOf(user));
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.permission.read)
  @ApiOperation({
    summary: 'Permission catalogue',
    description:
      'Every declared permission, each flagged with whether the caller may grant it — so the UI can disable rather than hide the rest.',
  })
  @ApiOkResponse({ type: PermissionOptionDto, isArray: true })
  listPermissions(@CurrentUser() user: AuthenticatedUser): Promise<PermissionOptionDto[]> {
    return this.roles.listPermissions(actorOf(user));
  }

  // Declared after `permissions` so the literal segment is not captured as :id.
  @Get(':id')
  @RequirePermissions(PERMISSIONS.role.read)
  @ApiOperation({ summary: 'Fetch a single role' })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiNotFoundResponse({ description: 'No such role' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoleResponseDto> {
    return this.roles.findOne(id, actorOf(user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.role.create)
  @ApiOperation({
    summary: 'Create a role for this school',
    description: 'You may only grant permissions you hold yourself.',
  })
  @ApiCreatedResponse({ type: RoleResponseDto })
  @ApiConflictResponse({ description: 'Name already used in this school' })
  @ApiForbiddenResponse({ description: 'Attempted to grant a permission you do not hold' })
  create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoleResponseDto> {
    return this.roles.create(dto, actorOf(user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.role.update)
  @ApiOperation({
    summary: 'Update a role',
    description: 'Sending `permissions` replaces the set wholesale. System roles are refused.',
  })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiForbiddenResponse({ description: 'System role, or permission you do not hold' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoleResponseDto> {
    return this.roles.update(id, dto, actorOf(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.role.delete)
  @ApiOperation({
    summary: 'Delete a role',
    description: 'Refused while any user still holds it — reassign them first.',
  })
  @ApiNoContentResponse({ description: 'Role deleted' })
  @ApiConflictResponse({ description: 'Role still in use' })
  @ApiForbiddenResponse({ description: 'System roles cannot be deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.roles.remove(id, actorOf(user));
  }
}
