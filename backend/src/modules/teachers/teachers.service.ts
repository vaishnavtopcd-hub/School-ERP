import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';

import { PERMISSIONS } from '@/common/constants';
import { type PaginatedResult, buildPaginationMeta } from '@/common/types';
import { PrismaService } from '@/core/prisma/prisma.service';
import { ClassesService } from '@/modules/classes/classes.service';
import { SubjectsService } from '@/modules/subjects/subjects.service';
import { UsersService } from '@/modules/users/users.service';

import {
  type CreateTeacherDto,
  type ListTeachersDto,
  type TeacherResponseDto,
  type UpdateTeacherDto,
} from './dto';

export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
}

/**
 * What makes someone teaching staff, for listing purposes.
 *
 * A *capability*, not a role name — role names are authored per school, so
 * matching on them would break the moment one was renamed. This is the same
 * rule the classes module uses to decide who may be a class teacher, which is
 * what keeps the two lists agreeing.
 *
 * It is deliberately broad (an Administrator holding `class:manage` qualifies);
 * the `roleId` filter is how a caller narrows to one role, and the response
 * carries `roles` so the UI can show *why* someone is listed.
 */
const TEACHING_PERMISSIONS: string[] = [
  PERMISSIONS.schoolClass.read,
  PERMISSIONS.schoolClass.manage,
];

const teachingRoleFilter: Prisma.UserWhereInput = {
  roles: {
    some: {
      role: { permissions: { some: { permission: { key: { in: TEACHING_PERMISSIONS } } } } },
    },
  },
};

/**
 * The row is a *user*; the employment record is joined in when it exists.
 *
 * That is the whole point of the role-based listing: someone holding a teaching
 * role appears immediately, with blank qualification and experience, rather
 * than being invisible until an administrator remembers to create a record.
 */
const teacherSelect = {
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
  createdAt: true,
  updatedAt: true,
  schoolId: true,
  roles: { select: { role: { select: { id: true, name: true } } } },
  teacherProfile: {
    select: {
      id: true,
      employeeCode: true,
      qualification: true,
      specialisation: true,
      experienceYears: true,
      joinedOn: true,
      bio: true,
      updatedAt: true,
    },
  },
  taughtSubjects: {
    select: {
      id: true,
      code: true,
      name: true,
      credits: true,
      class: { select: { id: true, name: true } },
    },
    orderBy: { code: 'asc' },
  },
  classTeacherOf: {
    select: { id: true, name: true, class: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  },
} satisfies Prisma.UserSelect;

type TeacherRow = Prisma.UserGetPayload<{ select: typeof teacherSelect }>;

/**
 * Teaching staff.
 *
 * Keyed by **user id**, not by profile id: a teacher is a user, and the
 * employment record is an optional extension created on first save. Everything
 * that already has an owner is delegated — account creation to UsersService,
 * subject allocation to SubjectsService, class-teacher allocation to
 * ClassesService, which holds the rules this module should not restate.
 */
@Injectable()
export class TeachersService {
  private readonly logger = new Logger(TeachersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly subjects: SubjectsService,
    private readonly classes: ClassesService,
  ) {}

  async findAll(query: ListTeachersDto, actor: Actor): Promise<PaginatedResult<TeacherResponseDto>> {
    const conditions: Prisma.UserWhereInput[] = [
      { deletedAt: null },
      ...(actor.isSuperAdmin ? [] : [{ schoolId: actor.schoolId ?? undefined }]),
      // Narrowing to one role replaces the capability rule rather than adding
      // to it, so picking a role always means "exactly this role".
      query.roleId
        ? { roles: { some: { roleId: query.roleId } } }
        : teachingRoleFilter,
    ];

    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      conditions.push({
        OR: [
          { firstName: contains },
          { lastName: contains },
          { email: contains },
          { teacherProfile: { employeeCode: contains } },
          { teacherProfile: { qualification: contains } },
          { teacherProfile: { specialisation: contains } },
        ],
      });
    }

    if (query.classId) {
      conditions.push({
        OR: [
          { taughtSubjects: { some: { classId: query.classId } } },
          { classTeacherOf: { some: { classId: query.classId } } },
        ],
      });
    }

    if (query.unallocated) {
      conditions.push({ taughtSubjects: { none: {} } });
    }

    const where: Prisma.UserWhereInput = { AND: conditions };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: teacherSelect,
        orderBy: this.orderBy(query),
        skip: query.skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toResponse(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(userId: string, actor: Actor): Promise<TeacherResponseDto> {
    return this.toResponse(await this.getOrThrow(userId, actor));
  }

  /**
   * Only needed for someone who has no account yet — anyone who already holds a
   * teaching role is in the list already, and editing them creates their record.
   */
  async create(dto: CreateTeacherDto, actor: Actor): Promise<TeacherResponseDto> {
    const userId = dto.userId
      ? await this.assertPromotable(dto.userId, actor)
      : await this.createAccount(dto, actor);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { schoolId: true },
    });

    if (!user.schoolId) {
      throw new BadRequestException(
        'Teachers belong to a school. The platform operator has none, so it cannot be one.',
      );
    }

    await this.assertEmployeeCodeAvailable(dto.employeeCode, user.schoolId);

    await this.prisma.teacherProfile.create({
      data: {
        userId,
        schoolId: user.schoolId,
        employeeCode: dto.employeeCode ?? null,
        qualification: dto.qualification ?? null,
        specialisation: dto.specialisation ?? null,
        experienceYears: dto.experienceYears ?? 0,
        joinedOn: dto.joinedOn ? new Date(dto.joinedOn) : null,
        bio: dto.bio ?? null,
      },
    });

    await this.audit(actor.id, 'teacher.created', userId, { promoted: Boolean(dto.userId) });

    return this.findOne(userId, actor);
  }

  /**
   * Upserts the employment record: a user listed purely on their role has none
   * until the first save, which is what makes the role-based rows editable
   * without a separate "add to staff" step.
   */
  async update(userId: string, dto: UpdateTeacherDto, actor: Actor): Promise<TeacherResponseDto> {
    const existing = await this.getOrThrow(userId, actor);

    if (!existing.schoolId) {
      throw new BadRequestException('This user belongs to no school, so has no employment record.');
    }

    if (
      dto.employeeCode !== undefined &&
      dto.employeeCode !== existing.teacherProfile?.employeeCode
    ) {
      await this.assertEmployeeCodeAvailable(dto.employeeCode, existing.schoolId, userId);
    }

    const joinedOn = dto.joinedOn === undefined ? undefined : dto.joinedOn ? new Date(dto.joinedOn) : null;

    await this.prisma.teacherProfile.upsert({
      where: { userId },
      update: {
        employeeCode: dto.employeeCode,
        qualification: dto.qualification,
        specialisation: dto.specialisation,
        experienceYears: dto.experienceYears,
        ...(joinedOn === undefined ? {} : { joinedOn }),
        bio: dto.bio,
      },
      create: {
        userId,
        schoolId: existing.schoolId,
        employeeCode: dto.employeeCode ?? null,
        qualification: dto.qualification ?? null,
        specialisation: dto.specialisation ?? null,
        experienceYears: dto.experienceYears ?? 0,
        joinedOn: joinedOn ?? null,
        bio: dto.bio ?? null,
      },
    });

    // Contact details and photo live on the user row. Email, status, and roles
    // are absent on purpose — each is a privileged action with its own endpoint.
    const { contact } = dto;
    if (contact) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          avatarUrl: contact.avatarUrl,
          addressLine1: contact.addressLine1,
          addressLine2: contact.addressLine2,
          city: contact.city,
          state: contact.state,
          postalCode: contact.postalCode,
          country: contact.country,
        },
      });
    }

    await this.audit(actor.id, 'teacher.updated', userId, {
      changed: Object.keys(dto).filter((key) => key !== 'contact'),
      contactChanged: contact ? Object.keys(contact) : [],
      createdProfile: !existing.teacherProfile,
    });

    return this.findOne(userId, actor);
  }

  /**
   * Removes the *employment record*, not the person.
   *
   * The account, its roles, and its sign-in survive — so someone still holding a
   * teaching role stays in the list, now without qualification or experience.
   * Refused while allocations remain, since the SetNull foreign keys would
   * otherwise strip them silently.
   */
  async remove(userId: string, actor: Actor): Promise<void> {
    const existing = await this.getOrThrow(userId, actor);

    if (!existing.teacherProfile) {
      throw new NotFoundException('This user has no employment record to remove.');
    }

    const subjects = existing.taughtSubjects.length;
    const sections = existing.classTeacherOf.length;

    if (subjects > 0 || sections > 0) {
      const parts = [
        subjects > 0 ? `${subjects} subject(s)` : null,
        sections > 0 ? `${sections} section(s)` : null,
      ].filter(Boolean);

      throw new ConflictException(
        `${existing.firstName} ${existing.lastName} is still allocated to ${parts.join(' and ')}. ` +
          'Unassign them first.',
      );
    }

    await this.prisma.teacherProfile.delete({ where: { userId } });

    await this.audit(actor.id, 'teacher.deleted', userId, {});
  }

  // -------------------------------------------------------------------------
  // Allocation — delegated, so the rules live in one place
  // -------------------------------------------------------------------------

  async allocateSubject(
    userId: string,
    subjectId: string,
    actor: Actor,
  ): Promise<TeacherResponseDto> {
    await this.getOrThrow(userId, actor);

    await this.subjects.update(subjectId, { teacherId: userId }, this.subjectActor(actor));
    await this.audit(actor.id, 'teacher.subject_allocated', userId, { subjectId });

    return this.findOne(userId, actor);
  }

  async deallocateSubject(
    userId: string,
    subjectId: string,
    actor: Actor,
  ): Promise<TeacherResponseDto> {
    const teacher = await this.getOrThrow(userId, actor);

    // Guarded so one teacher's page cannot unassign another's subject.
    if (!teacher.taughtSubjects.some((subject) => subject.id === subjectId)) {
      throw new NotFoundException('That subject is not allocated to this teacher');
    }

    await this.subjects.update(subjectId, { teacherId: null }, this.subjectActor(actor));
    await this.audit(actor.id, 'teacher.subject_deallocated', userId, { subjectId });

    return this.findOne(userId, actor);
  }

  /**
   * Delegated to ClassesService, which refuses an inactive user, one without a
   * teaching role, or one already holding a section this academic year.
   */
  async allocateSection(
    userId: string,
    sectionId: string,
    actor: Actor,
  ): Promise<TeacherResponseDto> {
    await this.getOrThrow(userId, actor);

    await this.classes.updateSection(
      sectionId,
      { classTeacherId: userId },
      { id: actor.id, schoolId: actor.schoolId },
    );
    await this.audit(actor.id, 'teacher.section_allocated', userId, { sectionId });

    return this.findOne(userId, actor);
  }

  async deallocateSection(
    userId: string,
    sectionId: string,
    actor: Actor,
  ): Promise<TeacherResponseDto> {
    const teacher = await this.getOrThrow(userId, actor);

    if (!teacher.classTeacherOf.some((section) => section.id === sectionId)) {
      throw new NotFoundException('That section is not allocated to this teacher');
    }

    await this.classes.updateSection(
      sectionId,
      { classTeacherId: null },
      { id: actor.id, schoolId: actor.schoolId },
    );
    await this.audit(actor.id, 'teacher.section_deallocated', userId, { sectionId });

    return this.findOne(userId, actor);
  }

  // -------------------------------------------------------------------------

  /** Profile columns are ordered through the relation; user columns directly. */
  private orderBy(query: ListTeachersDto): Prisma.UserOrderByWithRelationInput {
    const direction = query.sortOrder;

    switch (query.sortBy) {
      case 'employeeCode':
        return { teacherProfile: { employeeCode: direction } };
      case 'experienceYears':
        return { teacherProfile: { experienceYears: direction } };
      case 'joinedOn':
        return { teacherProfile: { joinedOn: direction } };
      case 'firstName':
        return { firstName: direction };
      default:
        return { createdAt: direction };
    }
  }

  private subjectActor(actor: Actor) {
    return { id: actor.id, schoolId: actor.schoolId, isSuperAdmin: actor.isSuperAdmin };
  }

  private async assertPromotable(userId: string, actor: Actor): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, schoolId: true, teacherProfile: { select: { id: true } } },
    });

    if (!user || (!actor.isSuperAdmin && user.schoolId !== actor.schoolId)) {
      throw new NotFoundException('User not found');
    }

    if (user.teacherProfile) {
      throw new ConflictException('That user already has an employment record.');
    }

    return user.id;
  }

  private async createAccount(dto: CreateTeacherDto, actor: Actor): Promise<string> {
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

  private async assertEmployeeCodeAvailable(
    employeeCode: string | null | undefined,
    schoolId: string,
    exceptUserId?: string,
  ): Promise<void> {
    if (!employeeCode) return;

    const clash = await this.prisma.teacherProfile.findFirst({
      where: {
        schoolId,
        employeeCode,
        ...(exceptUserId ? { NOT: { userId: exceptUserId } } : {}),
      },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(`Employee code "${employeeCode}" is already used in this school.`);
    }
  }

  private async getOrThrow(userId: string, actor: Actor): Promise<TeacherRow> {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: teacherSelect,
    });

    // Out-of-tenant reads 404 rather than 403, so ids do not leak.
    if (!row || (!actor.isSuperAdmin && row.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Teacher not found');
    }

    return row;
  }

  private toResponse(row: TeacherRow): TeacherResponseDto {
    const profile = row.teacherProfile;

    return {
      // Keyed by user: the employment record is optional, so it cannot be the
      // identity. `userId` is kept as an explicit alias for readability.
      id: row.id,
      userId: row.id,
      hasProfile: Boolean(profile),

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

      employeeCode: profile?.employeeCode ?? null,
      qualification: profile?.qualification ?? null,
      specialisation: profile?.specialisation ?? null,
      experienceYears: profile?.experienceYears ?? 0,
      // Date-only column: trimmed so it never carries a timezone the school did
      // not mean, matching how academic-year dates are handled.
      joinedOn: profile?.joinedOn ? profile.joinedOn.toISOString().slice(0, 10) : null,
      bio: profile?.bio ?? null,

      roles: row.roles.map(({ role }) => role.name),
      roleIds: row.roles.map(({ role }) => role.id),

      subjects: row.taughtSubjects.map((subject) => ({
        id: subject.id,
        code: subject.code,
        name: subject.name,
        credits: subject.credits,
        classId: subject.class.id,
        className: subject.class.name,
      })),
      sections: row.classTeacherOf.map((section) => ({
        id: section.id,
        name: section.name,
        classId: section.class.id,
        className: section.class.name,
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
          resource: 'teacher',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
