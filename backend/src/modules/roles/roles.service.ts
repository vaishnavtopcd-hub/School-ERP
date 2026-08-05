import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma, SystemRoleKey } from '@prisma/client';

import { PLATFORM_ONLY_PERMISSIONS } from '@/common/constants';
import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type CreateRoleDto,
  type PermissionOptionDto,
  type RoleResponseDto,
  type UpdateRoleDto,
} from './dto';

/** Identity of the administrator authoring roles. */
export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
  /** Permission keys the actor holds — the ceiling on what they may grant. */
  permissions: string[];
}

const roleSelect = {
  id: true,
  name: true,
  description: true,
  schoolId: true,
  systemKey: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  permissions: { select: { permission: { select: { key: true } } } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

type RoleRow = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;

/**
 * Runtime role authoring, scoped to one school.
 *
 * The whole module rests on one rule: **you cannot grant what you do not hold**.
 * Without it, anyone with `role:create` could author a role carrying every
 * permission and assign it to themselves, which would make the entire
 * permission model decorative.
 */
@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: Actor): Promise<RoleResponseDto[]> {
    const rows = await this.prisma.role.findMany({
      where: this.tenantWhere(actor),
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: roleSelect,
    });

    return rows.map((row) => this.toResponse(row));
  }

  async findOne(id: string, actor: Actor): Promise<RoleResponseDto> {
    return this.toResponse(await this.getOrThrow(id, actor));
  }

  /**
   * The permission catalogue, each flagged with whether this caller may grant
   * it. Returning the ungrantable ones too lets the UI show them disabled with
   * a reason, rather than silently omitting capabilities that exist.
   */
  async listPermissions(actor: Actor): Promise<PermissionOptionDto[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      select: { key: true, resource: true, action: true, description: true },
    });

    return permissions.map((permission) => ({
      ...permission,
      grantable: this.mayGrant(permission.key, actor),
    }));
  }

  async create(dto: CreateRoleDto, actor: Actor): Promise<RoleResponseDto> {
    const schoolId = this.requireSchool(actor);

    this.assertGrantable(dto.permissions, actor);
    await this.assertNameAvailable(dto.name, schoolId);

    const permissionIds = await this.resolvePermissionIds(dto.permissions);

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        schoolId,
        isSystem: false,
        permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
      select: roleSelect,
    });

    await this.audit(actor.id, 'role.created', role.id, {
      name: role.name,
      permissions: dto.permissions,
    });

    return this.toResponse(role);
  }

  async update(id: string, dto: UpdateRoleDto, actor: Actor): Promise<RoleResponseDto> {
    const existing = await this.getOrThrow(id, actor);

    this.assertMutable(existing);

    if (dto.permissions) {
      this.assertGrantable(dto.permissions, actor);
    }

    if (dto.name && dto.name !== existing.name) {
      await this.assertNameAvailable(dto.name, existing.schoolId);
    }

    const permissionIds = dto.permissions
      ? await this.resolvePermissionIds(dto.permissions)
      : null;

    const role = await this.prisma.$transaction(async (tx) => {
      if (permissionIds) {
        // Replace wholesale: the client sends the complete desired set, so
        // diffing here would only invent a second interpretation of the payload.
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          skipDuplicates: true,
        });
      }

      return tx.role.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
        select: roleSelect,
      });
    });

    await this.audit(actor.id, 'role.updated', id, { changed: Object.keys(dto) });

    return this.toResponse(role);
  }

  /**
   * Deleting a role strips it from everyone holding it — the join table
   * cascades — so it is refused while anyone still has it. Reassign first.
   */
  async remove(id: string, actor: Actor): Promise<void> {
    const existing = await this.getOrThrow(id, actor);

    this.assertMutable(existing);

    if (existing._count.users > 0) {
      throw new ConflictException(
        `${existing._count.users} user(s) still hold "${existing.name}". Reassign them first.`,
      );
    }

    await this.prisma.role.delete({ where: { id } });

    await this.audit(actor.id, 'role.deleted', id, { name: existing.name });
  }

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------

  private tenantWhere(actor: Actor): Prisma.RoleWhereInput {
    // The operator sees school roles too, but never edits them through here.
    return actor.isSuperAdmin ? {} : { schoolId: actor.schoolId };
  }

  private requireSchool(actor: Actor): string {
    if (!actor.schoolId) {
      throw new BadRequestException(
        'Roles belong to a school. The platform operator has none, so it cannot author roles.',
      );
    }
    return actor.schoolId;
  }

  private assertMutable(role: RoleRow): void {
    if (role.isSystem || role.systemKey) {
      throw new ForbiddenException(
        `"${role.name}" is a system role. It cannot be renamed, re-permissioned, or deleted.`,
      );
    }
  }

  /** A permission is grantable when the actor holds it, directly or via `manage`. */
  private mayGrant(key: string, actor: Actor): boolean {
    if (PLATFORM_ONLY_PERMISSIONS.includes(key)) {
      return actor.isSuperAdmin;
    }
    if (actor.isSuperAdmin) {
      return true;
    }

    const held = new Set(actor.permissions);
    return held.has(key) || held.has(`${key.split(':')[0]}:manage`);
  }

  private assertGrantable(keys: string[], actor: Actor): void {
    const refused = keys.filter((key) => !this.mayGrant(key, actor));

    if (refused.length > 0) {
      throw new ForbiddenException(
        `You cannot grant permissions you do not hold: ${refused.join(', ')}`,
      );
    }
  }

  private async assertNameAvailable(name: string, schoolId: string | null): Promise<void> {
    const clash = await this.prisma.role.findFirst({
      where: { name, schoolId },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(`A role named "${name}" already exists in this school`);
    }
  }

  private async resolvePermissionIds(keys: string[]): Promise<string[]> {
    if (keys.length === 0) {
      return [];
    }

    const rows = await this.prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });

    if (rows.length !== keys.length) {
      const found = new Set(rows.map((row) => row.key));
      throw new BadRequestException(
        `Unknown permission(s): ${keys.filter((key) => !found.has(key)).join(', ')}`,
      );
    }

    return rows.map((row) => row.id);
  }

  private async getOrThrow(id: string, actor: Actor): Promise<RoleRow> {
    const role = await this.prisma.role.findUnique({ where: { id }, select: roleSelect });

    // Out-of-tenant reads 404 rather than 403, so role ids do not leak.
    if (!role || (!actor.isSuperAdmin && role.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  private toResponse(row: RoleRow): RoleResponseDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      schoolId: row.schoolId,
      systemKey: row.systemKey,
      isSystem: row.isSystem,
      permissions: row.permissions.map(({ permission }) => permission.key),
      userCount: row._count.users,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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
          resource: 'role',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}

export { SystemRoleKey };
