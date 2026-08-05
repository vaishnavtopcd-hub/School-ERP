import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma, SystemRoleKey, UserStatus } from '@prisma/client';

import {
  DEFAULT_MEDIUMS,
  DEFAULT_SCHOOL_ROLES,
  SCHOOL_ADMIN_TEMPLATE,
  type RoleTemplate,
} from '@/common/constants';
import { type PaginatedResult, buildPaginationMeta } from '@/common/types';
import { PrismaService } from '@/core/prisma/prisma.service';
import { PasswordService } from '@/modules/auth/services/password.service';

import {
  type CreateSchoolAdminDto,
  type CreateSchoolDto,
  type ListSchoolsDto,
  type SchoolResponseDto,
  type UpdateSchoolDto,
} from './dto';
import { type UserResponseDto } from '@/modules/users/dto';

const schoolSelect = {
  id: true,
  name: true,
  code: true,
  email: true,
  phone: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SchoolSelect;

type SchoolRow = Prisma.SchoolGetPayload<{ select: typeof schoolSelect }>;

/**
 * Schools are the tenant boundary, so creating one is a platform-operator
 * action — see the `@RequireSystemRole` on the controller. Nothing here takes an
 * actor school: by construction the caller has none.
 */
@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async findAll(query: ListSchoolsDto): Promise<PaginatedResult<SchoolResponseDto>> {
    const where: Prisma.SchoolWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.school.count({ where }),
      this.prisma.school.findMany({
        where,
        select: schoolSelect,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
    ]);

    return {
      items: await Promise.all(rows.map((row) => this.toResponse(row))),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string): Promise<SchoolResponseDto> {
    return this.toResponse(await this.getOrThrow(id));
  }

  /**
   * Creates the school and provisions its starting role set in one transaction.
   *
   * The roles are created here rather than lazily because a school with no roles
   * is unusable: its administrator would have nothing to assign, and the locked
   * Administrator role has to exist before anyone can be appointed to it.
   */
  async create(dto: CreateSchoolDto, actorId: string): Promise<SchoolResponseDto> {
    const clash = await this.prisma.school.findUnique({
      where: { code: dto.code },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(`A school with code "${dto.code}" already exists`);
    }

    const templates: RoleTemplate[] = [SCHOOL_ADMIN_TEMPLATE, ...DEFAULT_SCHOOL_ROLES];

    const school = await this.prisma.$transaction(async (tx) => {
      const created = await tx.school.create({
        data: {
          name: dto.name,
          code: dto.code,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
        },
        select: schoolSelect,
      });

      // Resolve permission keys to ids once, not per role.
      const keys = [...new Set(templates.flatMap((template) => template.permissions))];
      const permissions = await tx.permission.findMany({
        where: { key: { in: keys } },
        select: { id: true, key: true },
      });
      const idByKey = new Map(permissions.map((p) => [p.key, p.id]));

      for (const template of templates) {
        const role = await tx.role.create({
          data: {
            name: template.name,
            description: template.description,
            schoolId: created.id,
            systemKey: template.systemKey,
            isSystem: template.isSystem ?? false,
          },
          select: { id: true },
        });

        const grants = template.permissions
          .map((key) => idByKey.get(key))
          .filter((value): value is string => Boolean(value))
          .map((permissionId) => ({ roleId: role.id, permissionId }));

        if (grants.length > 0) {
          await tx.rolePermission.createMany({ data: grants, skipDuplicates: true });
        }
      }

      // Sections reference a medium row, so a school with none could not record
      // a language of instruction at all until someone added one by hand.
      await tx.medium.createMany({
        data: DEFAULT_MEDIUMS.map((name) => ({ name, schoolId: created.id })),
        skipDuplicates: true,
      });

      return created;
    });

    await this.audit(actorId, 'school.created', school.id, {
      code: school.code,
      rolesProvisioned: templates.length,
    });

    return this.toResponse(school);
  }

  async update(id: string, dto: UpdateSchoolDto, actorId: string): Promise<SchoolResponseDto> {
    await this.getOrThrow(id);

    const school = await this.prisma.school.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        isActive: dto.isActive,
      },
      select: schoolSelect,
    });

    await this.audit(actorId, 'school.updated', id, { changed: Object.keys(dto) });

    return this.toResponse(school);
  }

  /**
   * Appoints an administrator for a school by creating an account already
   * holding that school's locked Administrator role.
   *
   * This is the only way that role is ever granted — `UsersService` refuses it
   * to anyone but the platform operator — which is what makes the flow
   * "operator appoints the admin, admin runs the school" hold.
   */
  async createAdmin(
    schoolId: string,
    dto: CreateSchoolAdminDto,
    actorId: string,
  ): Promise<UserResponseDto> {
    await this.getOrThrow(schoolId);

    const adminRole = await this.prisma.role.findFirst({
      where: { schoolId, systemKey: SystemRoleKey.SCHOOL_ADMIN },
      select: { id: true, name: true, systemKey: true },
    });

    if (!adminRole) {
      // Only reachable for a school created before roles were provisioned.
      throw new ConflictException(
        'This school has no Administrator role. It may predate role provisioning.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        status: UserStatus.ACTIVE,
        schoolId,
        roles: { create: [{ roleId: adminRole.id }] },
      },
      select: {
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
        roles: { select: { role: { select: { id: true, name: true, systemKey: true } } } },
      },
    });

    await this.audit(actorId, 'school.admin_appointed', schoolId, { userId: user.id });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      schoolId: user.schoolId,
      roles: user.roles.map(({ role }) => ({
        id: role.id,
        name: role.name,
        systemKey: role.systemKey,
      })),
      isLocked: false,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }

  /**
   * Deactivates rather than deletes.
   *
   * A hard delete cascades to every user, role, academic year, and class the
   * school owns — an irreversible action on a whole tenant's history. If that is
   * genuinely wanted it should be a separate, explicitly-named operation.
   */
  async deactivate(id: string, actorId: string): Promise<SchoolResponseDto> {
    const existing = await this.getOrThrow(id);

    if (!existing.isActive) {
      throw new ConflictException('This school is already inactive');
    }

    const school = await this.prisma.school.update({
      where: { id },
      data: { isActive: false },
      select: schoolSelect,
    });

    await this.audit(actorId, 'school.deactivated', id, { code: school.code });

    return this.toResponse(school);
  }

  private async getOrThrow(id: string): Promise<SchoolRow> {
    const school = await this.prisma.school.findUnique({ where: { id }, select: schoolSelect });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return school;
  }

  private async toResponse(row: SchoolRow): Promise<SchoolResponseDto> {
    // Counted here rather than via a `_count` on the row: `create` builds its
    // row inside the transaction *before* provisioning roles, so an embedded
    // count would report zero for a school that has just been given five.
    const [userCount, roleCount, adminCount] = await this.prisma.$transaction([
      this.prisma.user.count({
        where: { schoolId: row.id, deletedAt: null, status: UserStatus.ACTIVE },
      }),
      this.prisma.role.count({ where: { schoolId: row.id } }),
      this.prisma.user.count({
        where: {
          schoolId: row.id,
          deletedAt: null,
          roles: { some: { role: { systemKey: SystemRoleKey.SCHOOL_ADMIN } } },
        },
      }),
    ]);

    return {
      id: row.id,
      name: row.name,
      code: row.code,
      email: row.email,
      phone: row.phone,
      address: row.address,
      isActive: row.isActive,
      userCount,
      roleCount,
      hasAdmin: adminCount > 0,
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
          resource: 'school',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
