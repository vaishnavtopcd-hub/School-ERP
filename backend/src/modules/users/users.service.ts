import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma, SystemRoleKey, UserStatus } from '@prisma/client';

import { type PaginatedResult, buildPaginationMeta } from '@/common/types';
import { PrismaService } from '@/core/prisma/prisma.service';
import { PasswordService } from '@/modules/auth/services/password.service';
import { TokenService } from '@/modules/auth/services/token.service';

import {
  type AdminResetPasswordDto,
  type AssignRolesDto,
  type CreateUserDto,
  type ListUsersDto,
  type RoleOptionDto,
  type UpdateUserDto,
  type UpdateUserStatusDto,
  type UserResponseDto,
} from './dto';

/**
 * Identity of the administrator performing the action.
 *
 * `schoolId` is the tenant boundary: every read and write below is confined to
 * it. The platform operator has no school and is exempt, which is the *only*
 * way to act across tenants.
 */
export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
  /** Permission keys the actor holds — used to stop privilege escalation. */
  permissions: string[];
}

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
  schoolId: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  roles: {
    select: { role: { select: { id: true, name: true, systemKey: true, schoolId: true } } },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

/** True when the row holds its school's locked Administrator role. */
function isSchoolAdmin(row: UserRow): boolean {
  return row.roles.some(({ role }) => role.systemKey === SystemRoleKey.SCHOOL_ADMIN);
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async findAll(query: ListUsersDto, actor: Actor): Promise<PaginatedResult<UserResponseDto>> {
    const where = this.buildWhere(query, actor);

    // Count and page in one round trip — they must see the same snapshot, or
    // the last page can report a total that no longer matches its contents.
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toResponse(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string, actor: Actor): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });

    // A cross-tenant id is reported as missing rather than forbidden: telling a
    // caller "that exists but is not yours" leaks the other school's user ids.
    if (!user || !this.isVisibleTo(user.schoolId, actor)) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(user);
  }

  /**
   * Roles assignable by this actor, with their permissions — feeds the role
   * picker in the admin UI. Scoped to the actor's school, so one school's
   * administrator never sees another's role names.
   */
  async listRoles(actor: Actor): Promise<RoleOptionDto[]> {
    const roles = await this.prisma.role.findMany({
      where: actor.isSuperAdmin ? {} : { schoolId: actor.schoolId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        systemKey: true,
        isSystem: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      systemKey: role.systemKey,
      isSystem: role.isSystem,
      permissions: role.permissions.map(({ permission }) => permission.key),
    }));
  }

  /** The tenant boundary, in one place so every call site reads the same rule. */
  private isVisibleTo(rowSchoolId: string | null, actor: Actor): boolean {
    return actor.isSuperAdmin || (rowSchoolId !== null && rowSchoolId === actor.schoolId);
  }

  // -------------------------------------------------------------------------
  // Create / update
  // -------------------------------------------------------------------------

  async create(dto: CreateUserDto, actor: Actor): Promise<UserResponseDto> {
    // A school administrator cannot place a user in someone else's school, no
    // matter what the body says — only the platform operator picks a school.
    const schoolId = this.resolveTargetSchool(dto.schoolId, actor);

    const roleIds = await this.assertRolesGrantable(dto.roleIds ?? [], schoolId, actor);
    await this.assertEmailAvailable(dto.email);

    const passwordHash = await this.passwords.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passwordHash,
        status: dto.status ?? UserStatus.ACTIVE,
        schoolId,
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
      select: userSelect,
    });

    await this.audit(actor.id, 'user.created', user.id, { email: user.email, roleIds });

    return this.toResponse(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: Actor): Promise<UserResponseDto> {
    const target = await this.getActiveOrThrow(id, actor);

    if (dto.email) {
      await this.assertEmailAvailable(dto.email, id);
    }

    // Moving a user between schools is a platform-operator action; for anyone
    // else the field is ignored rather than honoured against another tenant.
    const schoolId = dto.schoolId === undefined ? undefined : actor.isSuperAdmin
      ? dto.schoolId
      : target.schoolId ?? undefined;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        schoolId,
      },
      select: userSelect,
    });

    await this.audit(actor.id, 'user.updated', id, { changed: Object.keys(dto) });

    return this.toResponse(user);
  }

  // -------------------------------------------------------------------------
  // Status / delete
  // -------------------------------------------------------------------------

  async setStatus(id: string, dto: UpdateUserStatusDto, actor: Actor): Promise<UserResponseDto> {
    const target = await this.getActiveOrThrow(id, actor);

    if (dto.status !== UserStatus.ACTIVE) {
      this.assertNotSelf(id, actor, 'You cannot disable your own account');
      await this.assertNotLastAdmin(
        target,
        'Disabling this account would leave no active administrator',
      );
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: dto.status,
        // Re-enabling should also clear a brute-force lockout, otherwise the
        // account is "active" but still refuses logins for another 15 minutes.
        ...(dto.status === UserStatus.ACTIVE ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
      },
      select: userSelect,
    });

    // A disabled user must not keep working off an unexpired token.
    if (dto.status !== UserStatus.ACTIVE) {
      await this.tokens.revokeAllForUser(id);
    }

    await this.audit(actor.id, 'user.status_changed', id, { status: dto.status });

    return this.toResponse(user);
  }

  /**
   * Soft delete. The row is kept so audit history stays meaningful, but the
   * address is released: `email` is globally unique, so leaving it in place
   * would permanently block re-creating that person. The original is preserved
   * inside the tombstone value and can be recovered by stripping the prefix.
   */
  async remove(id: string, actor: Actor): Promise<void> {
    const target = await this.getActiveOrThrow(id, actor);

    this.assertNotSelf(id, actor, 'You cannot delete your own account');
    await this.assertNotLastAdmin(
      target,
      'Deleting this account would leave no active administrator',
    );

    const now = new Date();
    const tombstone = `deleted+${now.getTime()}+${target.email}`.slice(0, 255);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: now,
          status: UserStatus.INACTIVE,
          email: tombstone,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    await this.audit(actor.id, 'user.deleted', id, { email: target.email });
  }

  // -------------------------------------------------------------------------
  // Password / roles
  // -------------------------------------------------------------------------

  /**
   * Administrative password reset — no knowledge of the old password required,
   * which is exactly why it is a separate permission from `user:update`.
   */
  async resetPassword(id: string, dto: AdminResetPasswordDto, actor: Actor): Promise<void> {
    await this.getActiveOrThrow(id, actor);

    const passwordHash = await this.passwords.hash(dto.newPassword);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    await this.audit(actor.id, 'user.password_reset', id, {});
  }

  /** Replaces the user's entire role set. */
  async assignRoles(id: string, dto: AssignRolesDto, actor: Actor): Promise<UserResponseDto> {
    const target = await this.getActiveOrThrow(id, actor);

    const roleIds = await this.assertRolesGrantable(dto.roleIds, target.schoolId, actor);

    const heldAdmin = isSchoolAdmin(target);
    const keepsAdmin = target.roles.some(
      ({ role }) => role.systemKey === SystemRoleKey.SCHOOL_ADMIN && roleIds.includes(role.id),
    );

    if (heldAdmin && !keepsAdmin) {
      this.assertNotSelf(id, actor, 'You cannot remove your own administrator role');
      await this.assertNotLastAdmin(
        target,
        'Removing this role would leave the school with no active administrator',
      );
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
        skipDuplicates: true,
      }),
    ]);

    // Permissions are re-read from the database on every request, so revoking
    // sessions is not required for correctness. It is done anyway: a privilege
    // change is a good moment to force a clean re-authentication.
    await this.tokens.revokeAllForUser(id);

    await this.audit(actor.id, 'user.roles_assigned', id, { roleIds });

    return this.findOne(id, actor);
  }

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  /** Where a newly created or edited user belongs. */
  private resolveTargetSchool(requested: string | undefined, actor: Actor): string | null {
    if (actor.isSuperAdmin) {
      return requested ?? null;
    }

    if (!actor.schoolId) {
      throw new ForbiddenException('Your account is not attached to a school');
    }

    return actor.schoolId;
  }

  /**
   * Validates a set of role ids and returns them.
   *
   * Three separate rules, each closing a different escalation route:
   *
   *  1. Every role must belong to the target user's school. Roles are per-school
   *     now, so an id from another tenant would silently import its permissions.
   *  2. Only the platform operator may grant a school's locked Administrator
   *     role — that is what makes "super admin appoints the school admin" a real
   *     boundary rather than a convention.
   *  3. Nobody may grant a permission they do not themselves hold. Without this,
   *     an actor with `user:assign-role` could author a role carrying anything
   *     and assign it to themselves.
   */
  private async assertRolesGrantable(
    roleIds: string[],
    schoolId: string | null,
    actor: Actor,
  ): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: {
        id: true,
        name: true,
        schoolId: true,
        systemKey: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles do not exist');
    }

    const foreign = roles.filter((role) => role.schoolId !== schoolId);
    if (foreign.length > 0) {
      throw new BadRequestException(
        `These roles belong to a different school: ${foreign.map((r) => r.name).join(', ')}`,
      );
    }

    if (!actor.isSuperAdmin) {
      const locked = roles.find((role) => role.systemKey === SystemRoleKey.SCHOOL_ADMIN);
      if (locked) {
        throw new ForbiddenException(
          `Only the platform operator can grant the "${locked.name}" role`,
        );
      }

      const held = new Set(actor.permissions);
      const escalating = roles.flatMap((role) =>
        role.permissions
          .map(({ permission }) => permission.key)
          .filter((key) => !held.has(key) && !held.has(`${key.split(':')[0]}:manage`)),
      );

      if (escalating.length > 0) {
        throw new ForbiddenException(
          `You cannot grant permissions you do not hold: ${[...new Set(escalating)].join(', ')}`,
        );
      }
    }

    return roles.map((role) => role.id);
  }

  private assertNotSelf(targetId: string, actor: Actor, message: string): void {
    if (targetId === actor.id) {
      throw new ForbiddenException(message);
    }
  }

  /**
   * Refuses any change that would remove a school's last active administrator,
   * which would otherwise lock that school out of user management permanently.
   *
   * Counted per school: school A losing its last admin is not rescued by school
   * B still having one.
   */
  private async assertNotLastAdmin(target: UserRow, message: string): Promise<void> {
    if (!isSchoolAdmin(target)) {
      return;
    }

    const remainingAdmins = await this.prisma.user.count({
      where: {
        id: { not: target.id },
        schoolId: target.schoolId,
        deletedAt: null,
        status: UserStatus.ACTIVE,
        roles: { some: { role: { systemKey: SystemRoleKey.SCHOOL_ADMIN } } },
      },
    });

    if (remainingAdmins === 0) {
      throw new ConflictException(message);
    }
  }

  private async assertEmailAvailable(email: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing && existing.id !== exceptId) {
      throw new ConflictException('A user with this email already exists');
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private buildWhere(query: ListUsersDto, actor: Actor): Prisma.UserWhereInput {
    const filters: Prisma.UserWhereInput[] = [];

    // The tenant clause is applied first and unconditionally. A caller-supplied
    // `schoolId` can only narrow within it, never escape it.
    if (!actor.isSuperAdmin) {
      filters.push({ schoolId: actor.schoolId });
    } else if (query.schoolId) {
      filters.push({ schoolId: query.schoolId });
    }

    // Filtered in the query rather than dropped from the page, so `meta.total`
    // still matches the rows returned — a client-side filter would show one
    // fewer row than the footer claims.
    if (query.excludeSelf) {
      filters.push({ id: { not: actor.id } });
    }

    if (!query.includeDeleted) {
      filters.push({ deletedAt: null });
    }

    if (query.status) {
      filters.push({ status: query.status });
    }

    if (query.roleId) {
      filters.push({ roles: { some: { roleId: query.roleId } } });
    }

    if (query.search) {
      filters.push({
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    // AND-nesting keeps the search OR from swallowing the other filters.
    return filters.length > 0 ? { AND: filters } : {};
  }

  private async getActiveOrThrow(id: string, actor: Actor): Promise<UserRow> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userSelect,
    });

    // Same reasoning as findOne: out-of-tenant reads 404 rather than 403.
    if (!user || !this.isVisibleTo(user.schoolId, actor)) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private toResponse(row: UserRow): UserResponseDto {
    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      status: row.status,
      schoolId: row.schoolId,
      roles: row.roles.map(({ role }) => ({
        id: role.id,
        name: role.name,
        systemKey: role.systemKey,
      })),
      isLocked: row.lockedUntil !== null && row.lockedUntil > new Date(),
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  private async audit(
    actorId: string,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action,
          resource: 'user',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
