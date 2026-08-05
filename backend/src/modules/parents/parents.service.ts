import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';

import { type PaginatedResult, buildPaginationMeta } from '@/common/types';
import { PrismaService } from '@/core/prisma/prisma.service';
import { UsersService } from '@/modules/users/users.service';

import {
  type CreateParentDto,
  type LinkStudentDto,
  type ListParentsDto,
  type ParentResponseDto,
  type UpdateLinkDto,
  type UpdateParentDto,
} from './dto';

export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
}

const parentSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  phone: true,
  avatarUrl: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  schoolId: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { name: true } } } },
  parentProfile: {
    select: {
      occupation: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true,
      notes: true,
      updatedAt: true,
    },
  },
  guardianOf: {
    select: {
      relationship: true,
      isPrimaryContact: true,
      student: {
        select: {
          id: true,
          admissionNo: true,
          firstName: true,
          lastName: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
    orderBy: { student: { admissionNo: 'asc' } },
  },
} satisfies Prisma.UserSelect;

type ParentRow = Prisma.UserGetPayload<{ select: typeof parentSelect }>;

/**
 * Guardians.
 *
 * A parent is a `User` with a `ParentProfile`, so this owns only the guardian
 * record and the links to students; account creation is handed to UsersService.
 *
 * Unlike teachers, the list is **profile-driven** rather than role-driven: a
 * teacher is identifiable by capability (their role grants class access), but
 * the Parent role grants nothing at all, so there is no capability to match on.
 * Being a guardian is therefore recorded explicitly — which is also the honest
 * model, since guardianship is a fact about a person, not a permission.
 */
@Injectable()
export class ParentsService {
  private readonly logger = new Logger(ParentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(query: ListParentsDto, actor: Actor): Promise<PaginatedResult<ParentResponseDto>> {
    const conditions: Prisma.UserWhereInput[] = [
      { deletedAt: null },
      // The record is what makes someone a guardian.
      { parentProfile: { isNot: null } },
      ...(actor.isSuperAdmin ? [] : [{ schoolId: actor.schoolId ?? undefined }]),
    ];

    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      conditions.push({
        OR: [
          { firstName: contains },
          { lastName: contains },
          { email: contains },
          { phone: contains },
          { parentProfile: { occupation: contains } },
          // Finding a guardian by their child's name is how the office
          // actually looks someone up.
          { guardianOf: { some: { student: { firstName: contains } } } },
          { guardianOf: { some: { student: { lastName: contains } } } },
          { guardianOf: { some: { student: { admissionNo: contains } } } },
        ],
      });
    }

    if (query.studentId) {
      conditions.push({ guardianOf: { some: { studentId: query.studentId } } });
    }

    if (query.classId) {
      conditions.push({ guardianOf: { some: { student: { classId: query.classId } } } });
    }

    if (query.unlinked) {
      conditions.push({ guardianOf: { none: {} } });
    }

    const where: Prisma.UserWhereInput = { AND: conditions };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: parentSelect,
        orderBy: { [query.sortBy ?? 'firstName']: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toResponse(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(userId: string, actor: Actor): Promise<ParentResponseDto> {
    return this.toResponse(await this.getOrThrow(userId, actor));
  }

  async create(dto: CreateParentDto, actor: Actor): Promise<ParentResponseDto> {
    const userId = dto.userId
      ? await this.assertPromotable(dto.userId, actor)
      : await this.createAccount(dto, actor);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { schoolId: true },
    });

    if (!user.schoolId) {
      throw new BadRequestException(
        'Guardians belong to a school. The platform operator has none, so it cannot be one.',
      );
    }

    await this.prisma.parentProfile.create({
      data: {
        userId,
        schoolId: user.schoolId,
        occupation: dto.occupation ?? null,
        emergencyContactName: dto.emergencyContactName ?? null,
        emergencyContactPhone: dto.emergencyContactPhone ?? null,
        emergencyContactRelation: dto.emergencyContactRelation ?? null,
        notes: dto.notes ?? null,
      },
    });

    await this.audit(actor.id, 'parent.created', userId, { promoted: Boolean(dto.userId) });

    return this.findOne(userId, actor);
  }

  async update(userId: string, dto: UpdateParentDto, actor: Actor): Promise<ParentResponseDto> {
    await this.getOrThrow(userId, actor);

    await this.prisma.parentProfile.update({
      where: { userId },
      data: {
        occupation: dto.occupation,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        emergencyContactRelation: dto.emergencyContactRelation,
        notes: dto.notes,
      },
    });

    // Contact details and address live on the user row. Email, status, and
    // roles are absent on purpose — each has its own endpoint under /users.
    const { contact } = dto;
    if (contact) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          addressLine1: contact.addressLine1,
          addressLine2: contact.addressLine2,
          city: contact.city,
          state: contact.state,
          postalCode: contact.postalCode,
          country: contact.country,
        },
      });
    }

    await this.audit(actor.id, 'parent.updated', userId, {
      changed: Object.keys(dto).filter((key) => key !== 'contact'),
      contactChanged: contact ? Object.keys(contact) : [],
    });

    return this.findOne(userId, actor);
  }

  /**
   * Removes the *guardian record*, not the person.
   *
   * Refused while students are still linked: dropping the record would cascade
   * the links away, silently detaching children from a contact rather than
   * making someone decide.
   */
  async remove(userId: string, actor: Actor): Promise<void> {
    const existing = await this.getOrThrow(userId, actor);

    if (existing.guardianOf.length > 0) {
      throw new ConflictException(
        `${existing.firstName} ${existing.lastName} is still the guardian of ` +
          `${existing.guardianOf.length} student(s). Unlink them first.`,
      );
    }

    await this.prisma.parentProfile.delete({ where: { userId } });

    await this.audit(actor.id, 'parent.deleted', userId, {});
  }

  // -------------------------------------------------------------------------
  // Student relationships
  // -------------------------------------------------------------------------

  async linkStudent(
    userId: string,
    dto: LinkStudentDto,
    actor: Actor,
  ): Promise<ParentResponseDto> {
    const parent = await this.getOrThrow(userId, actor);
    const student = await this.assertStudentInSchool(dto.studentId, parent.schoolId);

    const existing = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: userId, studentId: student.id } },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('That student is already linked to this guardian.');
    }

    if (dto.isPrimaryContact) {
      await this.clearPrimaryContact(student.id);
    }

    await this.prisma.parentStudent.create({
      data: {
        parentId: userId,
        studentId: student.id,
        relationship: dto.relationship,
        isPrimaryContact: dto.isPrimaryContact ?? false,
      },
    });

    await this.audit(actor.id, 'parent.student_linked', userId, {
      studentId: student.id,
      relationship: dto.relationship,
    });

    return this.findOne(userId, actor);
  }

  async updateLink(
    userId: string,
    studentId: string,
    dto: UpdateLinkDto,
    actor: Actor,
  ): Promise<ParentResponseDto> {
    await this.getOrThrow(userId, actor);
    await this.getLinkOrThrow(userId, studentId);

    if (dto.isPrimaryContact) {
      await this.clearPrimaryContact(studentId, userId);
    }

    await this.prisma.parentStudent.update({
      where: { parentId_studentId: { parentId: userId, studentId } },
      data: { relationship: dto.relationship, isPrimaryContact: dto.isPrimaryContact },
    });

    await this.audit(actor.id, 'parent.link_updated', userId, { studentId, ...dto });

    return this.findOne(userId, actor);
  }

  async unlinkStudent(
    userId: string,
    studentId: string,
    actor: Actor,
  ): Promise<ParentResponseDto> {
    await this.getOrThrow(userId, actor);
    await this.getLinkOrThrow(userId, studentId);

    await this.prisma.parentStudent.delete({
      where: { parentId_studentId: { parentId: userId, studentId } },
    });

    await this.audit(actor.id, 'parent.student_unlinked', userId, { studentId });

    return this.findOne(userId, actor);
  }

  // -------------------------------------------------------------------------

  /**
   * At most one primary contact per student.
   *
   * Enforced here rather than in the schema: Postgres cannot express "at most
   * one true per group" without a partial unique index, and demoting the
   * previous holder silently is friendlier than refusing the change.
   */
  private async clearPrimaryContact(studentId: string, exceptParentId?: string): Promise<void> {
    await this.prisma.parentStudent.updateMany({
      where: {
        studentId,
        isPrimaryContact: true,
        ...(exceptParentId ? { NOT: { parentId: exceptParentId } } : {}),
      },
      data: { isPrimaryContact: false },
    });
  }

  private async assertStudentInSchool(
    studentId: string,
    schoolId: string | null,
  ): Promise<{ id: string }> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, schoolId: true },
    });

    if (!student || student.schoolId !== schoolId) {
      throw new NotFoundException('Student not found');
    }

    return { id: student.id };
  }

  private async getLinkOrThrow(parentId: string, studentId: string): Promise<void> {
    const link = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { id: true },
    });

    if (!link) {
      throw new NotFoundException('That student is not linked to this guardian.');
    }
  }

  private async assertPromotable(userId: string, actor: Actor): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, schoolId: true, parentProfile: { select: { id: true } } },
    });

    if (!user || (!actor.isSuperAdmin && user.schoolId !== actor.schoolId)) {
      throw new NotFoundException('User not found');
    }

    if (user.parentProfile) {
      throw new ConflictException('That user is already a guardian.');
    }

    return user.id;
  }

  private async createAccount(dto: CreateParentDto, actor: Actor): Promise<string> {
    const missing = (['email', 'firstName', 'lastName', 'password'] as const).filter(
      (field) => !dto[field],
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `Supply either userId to promote an existing user, or ${missing.join(', ')} to create one.`,
      );
    }

    const created = await this.users.create(
      {
        email: dto.email as string,
        firstName: dto.firstName as string,
        lastName: dto.lastName as string,
        phone: dto.phone ?? undefined,
        password: dto.password as string,
        status: UserStatus.ACTIVE,
        roleIds: dto.roleIds ?? [],
      },
      actor,
    );

    return created.id;
  }

  private async getOrThrow(userId: string, actor: Actor): Promise<ParentRow> {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, parentProfile: { isNot: null } },
      select: parentSelect,
    });

    // Out-of-tenant reads 404 rather than 403, so ids do not leak.
    if (!row || (!actor.isSuperAdmin && row.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Guardian not found');
    }

    return row;
  }

  private toResponse(row: ParentRow): ParentResponseDto {
    const profile = row.parentProfile;

    return {
      id: row.id,
      userId: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      status: row.status,
      phone: row.phone,
      avatarUrl: row.avatarUrl,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      country: row.country,
      occupation: profile?.occupation ?? null,
      emergencyContactName: profile?.emergencyContactName ?? null,
      emergencyContactPhone: profile?.emergencyContactPhone ?? null,
      emergencyContactRelation: profile?.emergencyContactRelation ?? null,
      notes: profile?.notes ?? null,
      roles: row.roles.map(({ role }) => role.name),
      students: row.guardianOf.map((link) => ({
        id: link.student.id,
        admissionNo: link.student.admissionNo,
        firstName: link.student.firstName,
        lastName: link.student.lastName,
        className: link.student.class?.name ?? null,
        sectionName: link.student.section?.name ?? null,
        relationship: link.relationship,
        isPrimaryContact: link.isPrimaryContact,
      })),
      createdAt: row.createdAt,
      updatedAt: profile?.updatedAt ?? row.updatedAt,
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
          resource: 'parent',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
