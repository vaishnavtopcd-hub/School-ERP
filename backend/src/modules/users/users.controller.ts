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
  Put,
  Query,
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

import { ApiPaginatedResponse, CurrentUser, RequirePermissions } from '@/common/decorators';
import { PERMISSIONS } from '@/common/constants';
import { type AuthenticatedUser, type PaginatedResult } from '@/common/types';

import {
  AdminResetPasswordDto,
  AssignRolesDto,
  CreateUserDto,
  ListUsersDto,
  RoleOptionDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UserResponseDto,
} from './dto';
import { type Actor, UsersService } from './users.service';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
  permissions: user.permissions,
});

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.user.read)
  @ApiOperation({
    summary: 'List users',
    description:
      'Paginated. Supports free-text search over name and email, plus status/role filters.',
  })
  @ApiPaginatedResponse(UserResponseDto)
  findAll(
    @Query() query: ListUsersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<UserResponseDto>> {
    return this.users.findAll(query, actorOf(user));
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.role.read)
  @ApiOperation({
    summary: 'Roles available for assignment',
    description: "Includes each role's permissions, so the UI can explain what a role grants.",
  })
  @ApiOkResponse({ type: RoleOptionDto, isArray: true })
  listRoles(@CurrentUser() user: AuthenticatedUser): Promise<RoleOptionDto[]> {
    return this.users.listRoles(actorOf(user));
  }

  // Declared after `roles` so the literal segment is not captured as an :id.
  @Get(':id')
  @RequirePermissions(PERMISSIONS.user.read)
  @ApiOperation({ summary: 'Fetch a single user' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'No such user' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.users.findOne(id, actorOf(user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.user.create)
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'Email already in use' })
  @ApiForbiddenResponse({ description: 'Only an administrator may grant the ADMIN role' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.users.create(dto, actorOf(actor));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.user.update)
  @ApiOperation({
    summary: 'Update a user profile',
    description: 'Password, status, and roles are changed through their own endpoints.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'Email already in use' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.users.update(id, dto, actorOf(actor));
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.user.update)
  @ApiOperation({
    summary: 'Enable, disable, or suspend a user',
    description: 'Disabling revokes every session immediately.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'You cannot disable your own account' })
  @ApiConflictResponse({ description: 'Would leave no active administrator' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.users.setStatus(id, dto, actorOf(actor));
  }

  @Put(':id/roles')
  @RequirePermissions(PERMISSIONS.user.assignRole)
  @ApiOperation({
    summary: "Replace a user's roles",
    description: 'Sends the complete desired set — roles not listed are removed.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Privilege escalation or self-demotion refused' })
  @ApiConflictResponse({ description: 'Would leave no active administrator' })
  assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRolesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.users.assignRoles(id, dto, actorOf(actor));
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.user.resetPassword)
  @ApiOperation({
    summary: "Set a user's password administratively",
    description:
      'Does not require the old password, clears any lockout, and ends every session for the account.',
  })
  @ApiNoContentResponse({ description: 'Password updated' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.users.resetPassword(id, dto, actorOf(actor));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.user.delete)
  @ApiOperation({
    summary: 'Delete a user',
    description:
      'Soft delete: the record is retained for audit purposes but the email address is released for reuse.',
  })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiForbiddenResponse({ description: 'You cannot delete your own account' })
  @ApiConflictResponse({ description: 'Would leave no active administrator' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.users.remove(id, actorOf(actor));
  }
}
