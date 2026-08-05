import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearStatus, Prisma, UserStatus } from '@prisma/client';

import { PERMISSIONS } from '@/common/constants';
import { type PaginatedResult, buildPaginationMeta } from '@/common/types';
import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type ClassResponseDto,
  type CreateClassDto,
  type CreateSectionDto,
  type EligibleTeacherDto,
  type ListClassesDto,
  type SectionResponseDto,
  type UpdateClassDto,
  type UpdateSectionDto,
} from './dto';

export interface Actor {
  id: string;
  schoolId: string | null;
}

/**
 * Eligibility to be a class teacher is a *capability*, not a role name.
 *
 * Role names are authored per school now ("Teacher", "Faculty", "Form Tutor"),
 * so matching on them would break the moment a school renamed one. Holding a
 * role that can read classes is the durable expression of "is teaching staff".
 */
const CLASS_TEACHER_PERMISSIONS: string[] = [
  PERMISSIONS.schoolClass.read,
  PERMISSIONS.schoolClass.manage,
];

/**
 * Infers the ordering key from a class name.
 *
 * `level` exists solely so "Class 10" sorts after "Class 9" — alphabetically it
 * would not. Since it is derivable from the name in practice, it is no longer
 * asked for: the first number in the name is the grade, and anything without one
 * (Nursery, LKG) is pre-primary and sorts first at 0.
 */
export function deriveLevel(name: string): number {
  const match = /\d+/.exec(name);
  if (!match) return 0;

  return Math.min(20, Math.max(0, Number.parseInt(match[0], 10)));
}

/** Prisma filter for "user holds a role granting one of the above". */
const teachingRoleFilter = {
  some: {
    role: {
      permissions: { some: { permission: { key: { in: CLASS_TEACHER_PERMISSIONS } } } },
    },
  },
} satisfies Prisma.UserRoleListRelationFilter;

const sectionSelect = {
  id: true,
  name: true,
  capacity: true,
  isActive: true,
  classId: true,
  division: true,
  createdAt: true,
  updatedAt: true,
  medium: { select: { id: true, name: true } },
  classTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.SectionSelect;

const classSelect = {
  id: true,
  name: true,
  level: true,
  isActive: true,
  academicYearId: true,
  schoolId: true,
  createdAt: true,
  updatedAt: true,
  sections: { select: sectionSelect, orderBy: { name: 'asc' } },
} satisfies Prisma.SchoolClassSelect;

type ClassRow = Prisma.SchoolClassGetPayload<{ select: typeof classSelect }>;
type SectionRow = Prisma.SectionGetPayload<{ select: typeof sectionSelect }>;

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Classes
  // -------------------------------------------------------------------------

  async findAll(query: ListClassesDto, actor: Actor): Promise<PaginatedResult<ClassResponseDto>> {
    const academicYearId = await this.resolveAcademicYearId(query.academicYearId, actor);

    const where: Prisma.SchoolClassWhereInput = { academicYearId };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.schoolClass.count({ where }),
      this.prisma.schoolClass.findMany({
        where,
        select: classSelect,
        orderBy: { [query.sortBy ?? 'level']: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toClassResponse(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string): Promise<ClassResponseDto> {
    return this.toClassResponse(await this.getClassOrThrow(id));
  }

  async createClass(dto: CreateClassDto, actor: Actor): Promise<ClassResponseDto> {
    const academicYearId = await this.resolveAcademicYearId(dto.academicYearId, actor);
    const year = await this.assertYearEditable(academicYearId);

    await this.assertClassNameAvailable(academicYearId, dto.name);

    const row = await this.prisma.schoolClass.create({
      data: {
        name: dto.name,
        level: dto.level ?? deriveLevel(dto.name),
        isActive: dto.isActive ?? true,
        academicYearId,
        schoolId: year.schoolId,
      },
      select: classSelect,
    });

    await this.audit(actor.id, 'class.created', row.id, { name: row.name, level: row.level });

    return this.toClassResponse(row);
  }

  async updateClass(id: string, dto: UpdateClassDto, actor: Actor): Promise<ClassResponseDto> {
    const existing = await this.getClassOrThrow(id);
    await this.assertYearEditable(existing.academicYearId);

    if (dto.name && dto.name !== existing.name) {
      await this.assertClassNameAvailable(existing.academicYearId, dto.name);
    }

    const row = await this.prisma.schoolClass.update({
      where: { id },
      data: {
        name: dto.name,
        // A rename must re-derive the ordering key, or "Class 9" renamed to
        // "Class 10" would keep sorting in its old place.
        level: dto.level ?? (dto.name ? deriveLevel(dto.name) : undefined),
        isActive: dto.isActive,
      },
      select: classSelect,
    });

    await this.audit(actor.id, 'class.updated', id, { changed: Object.keys(dto) });

    return this.toClassResponse(row);
  }

  /** Deleting a class removes its sections too — the schema cascades. */
  async removeClass(id: string, actor: Actor): Promise<void> {
    const existing = await this.getClassOrThrow(id);
    await this.assertYearEditable(existing.academicYearId);

    await this.prisma.schoolClass.delete({ where: { id } });

    await this.audit(actor.id, 'class.deleted', id, {
      name: existing.name,
      sectionsRemoved: existing.sections.length,
    });
  }

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  async createSection(
    classId: string,
    dto: CreateSectionDto,
    actor: Actor,
  ): Promise<SectionResponseDto> {
    const parent = await this.getClassOrThrow(classId);
    await this.assertYearEditable(parent.academicYearId);
    const division = dto.division ?? '';
    await this.assertSectionNameAvailable(classId, dto.name, division);

    if (dto.mediumId) {
      await this.assertMediumUsable(dto.mediumId, parent.schoolId);
    }

    if (dto.classTeacherId) {
      await this.assertTeacherAssignable(
        dto.classTeacherId,
        parent.schoolId,
        parent.academicYearId,
      );
    }

    const row = await this.prisma.section.create({
      data: {
        name: dto.name,
        capacity: dto.capacity,
        division,
        mediumId: dto.mediumId ?? null,
        isActive: dto.isActive ?? true,
        classId,
        classTeacherId: dto.classTeacherId ?? null,
      },
      select: sectionSelect,
    });

    await this.audit(actor.id, 'section.created', row.id, {
      classId,
      name: row.name,
      capacity: row.capacity,
      division: row.division,
      mediumId: row.medium?.id ?? null,
    });

    return this.toSectionResponse(row);
  }

  async updateSection(
    sectionId: string,
    dto: UpdateSectionDto,
    actor: Actor,
  ): Promise<SectionResponseDto> {
    const existing = await this.getSectionOrThrow(sectionId);
    const parent = await this.getClassOrThrow(existing.classId);
    await this.assertYearEditable(parent.academicYearId);

    // Either half of the (name, division) pair changing can create a clash, so
    // the check runs whenever either is touched — not just on a rename.
    const nextName = dto.name ?? existing.name;
    const nextDivision = dto.division ?? existing.division;

    if (nextName !== existing.name || nextDivision !== existing.division) {
      await this.assertSectionNameAvailable(existing.classId, nextName, nextDivision);
    }

    if (dto.mediumId) {
      await this.assertMediumUsable(dto.mediumId, parent.schoolId);
    }

    // `undefined` leaves the teacher alone; `null` clears it.
    if (dto.classTeacherId) {
      await this.assertTeacherAssignable(
        dto.classTeacherId,
        parent.schoolId,
        parent.academicYearId,
        sectionId,
      );
    }

    const row = await this.prisma.section.update({
      where: { id: sectionId },
      data: {
        name: dto.name,
        capacity: dto.capacity,
        division: dto.division,
        isActive: dto.isActive,
        ...(dto.mediumId !== undefined ? { mediumId: dto.mediumId } : {}),
        ...(dto.classTeacherId !== undefined ? { classTeacherId: dto.classTeacherId } : {}),
      },
      select: sectionSelect,
    });

    await this.audit(actor.id, 'section.updated', sectionId, { changed: Object.keys(dto) });

    return this.toSectionResponse(row);
  }

  async removeSection(sectionId: string, actor: Actor): Promise<void> {
    const existing = await this.getSectionOrThrow(sectionId);
    const parent = await this.getClassOrThrow(existing.classId);
    await this.assertYearEditable(parent.academicYearId);

    await this.prisma.section.delete({ where: { id: sectionId } });

    await this.audit(actor.id, 'section.deleted', sectionId, {
      classId: existing.classId,
      name: existing.name,
    });
  }

  /**
   * Teachers who may be assigned as a class teacher this year, each flagged with
   * whether they already hold another section — so the UI can warn before the
   * API rejects.
   */
  async listEligibleTeachers(
    academicYearId: string | undefined,
    actor: Actor,
  ): Promise<EligibleTeacherDto[]> {
    const yearId = await this.resolveAcademicYearId(academicYearId, actor);
    const year = await this.prisma.academicYear.findUniqueOrThrow({
      where: { id: yearId },
      select: { schoolId: true },
    });

    const teachers = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        schoolId: year.schoolId,
        roles: teachingRoleFilter,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        classTeacherOf: {
          where: { class: { academicYearId: yearId } },
          select: { name: true, class: { select: { name: true } } },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return teachers.map((teacher) => {
      const held = teacher.classTeacherOf[0];
      return {
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        isAssigned: Boolean(held),
        assignedTo: held ? `${held.class.name} - ${held.name}` : null,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * An archived year is a historical record; its structure must stay frozen or
   * past attendance and results stop reconciling.
   */
  private async assertYearEditable(academicYearId: string): Promise<{ schoolId: string }> {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { id: true, schoolId: true, status: true, name: true },
    });

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    if (year.status === AcademicYearStatus.ARCHIVED) {
      throw new ConflictException(
        `"${year.name}" is archived. Classes in an archived year cannot be changed.`,
      );
    }

    return { schoolId: year.schoolId };
  }

  /**
   * A section's medium must belong to the same school.
   *
   * Without this an id from another tenant would attach silently — the foreign
   * key only proves the row exists, not that it is this school's.
   */
  private async assertMediumUsable(mediumId: string, schoolId: string): Promise<void> {
    const medium = await this.prisma.medium.findUnique({
      where: { id: mediumId },
      select: { schoolId: true, isActive: true, name: true },
    });

    if (!medium || medium.schoolId !== schoolId) {
      throw new BadRequestException('The selected medium does not belong to this school');
    }

    if (!medium.isActive) {
      throw new BadRequestException(`"${medium.name}" is no longer offered`);
    }
  }

  private async assertClassNameAvailable(academicYearId: string, name: string): Promise<void> {
    const clash = await this.prisma.schoolClass.findFirst({
      where: { academicYearId, name },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(`A class named "${name}" already exists for this academic year`);
    }
  }

  /**
   * Section names are unique per division, not outright — "A" may exist once as
   * Science and once as Commerce. The message names the division so the clash
   * is obvious when a school does stream.
   */
  private async assertSectionNameAvailable(
    classId: string,
    name: string,
    division: string,
  ): Promise<void> {
    const clash = await this.prisma.section.findFirst({
      where: { classId, name, division },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(`Section "${name}" already exists in this class`);
    }
  }

  /**
   * A class teacher must be an active member of staff at the same school, and
   * may hold only one section per academic year — the role is a pastoral
   * responsibility, not a label.
   */
  private async assertTeacherAssignable(
    teacherId: string,
    schoolId: string,
    academicYearId: string,
    exceptSectionId?: string,
  ): Promise<void> {
    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, deletedAt: null },
      select: {
        id: true,
        status: true,
        schoolId: true,
        firstName: true,
        lastName: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('The selected class teacher does not exist');
    }

    if (teacher.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('The selected class teacher is not an active user');
    }

    if (teacher.schoolId !== schoolId) {
      throw new BadRequestException('The selected class teacher belongs to a different school');
    }

    const hasTeachingRole = teacher.roles.some(({ role }) =>
      role.permissions.some(({ permission }) =>
        CLASS_TEACHER_PERMISSIONS.includes(permission.key),
      ),
    );

    if (!hasTeachingRole) {
      throw new BadRequestException(
        'A class teacher must hold a role that can access classes (e.g. Teacher or Headmaster)',
      );
    }

    const alreadyAssigned = await this.prisma.section.findFirst({
      where: {
        classTeacherId: teacherId,
        class: { academicYearId },
        ...(exceptSectionId ? { id: { not: exceptSectionId } } : {}),
      },
      select: { name: true, class: { select: { name: true } } },
    });

    if (alreadyAssigned) {
      throw new ConflictException(
        `${teacher.firstName} ${teacher.lastName} is already class teacher of ` +
          `${alreadyAssigned.class.name} - ${alreadyAssigned.name}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async getClassOrThrow(id: string): Promise<ClassRow> {
    const row = await this.prisma.schoolClass.findUnique({ where: { id }, select: classSelect });

    if (!row) {
      throw new NotFoundException('Class not found');
    }

    return row;
  }

  private async getSectionOrThrow(id: string): Promise<SectionRow> {
    const row = await this.prisma.section.findUnique({ where: { id }, select: sectionSelect });

    if (!row) {
      throw new NotFoundException('Section not found');
    }

    return row;
  }

  /**
   * Classes always belong to a year. When the caller does not name one, fall
   * back to whichever year is currently active for their school.
   */
  private async resolveAcademicYearId(provided: string | undefined, actor: Actor): Promise<string> {
    if (provided) {
      return provided;
    }

    if (!actor.schoolId) {
      throw new BadRequestException(
        'No school could be determined. Supply academicYearId, or use an account attached to a school.',
      );
    }

    const active = await this.prisma.academicYear.findFirst({
      where: { schoolId: actor.schoolId, status: AcademicYearStatus.ACTIVE },
      select: { id: true },
    });

    if (!active) {
      throw new BadRequestException(
        'This school has no active academic year. Activate one, or supply academicYearId.',
      );
    }

    return active.id;
  }

  private toClassResponse(row: ClassRow): ClassResponseDto {
    const sections = row.sections.map((section) => this.toSectionResponse(section));

    return {
      id: row.id,
      name: row.name,
      level: row.level,
      isActive: row.isActive,
      academicYearId: row.academicYearId,
      schoolId: row.schoolId,
      sections,
      sectionCount: sections.length,
      // Inactive sections are not taking students, so they do not count.
      totalCapacity: sections
        .filter((section) => section.isActive)
        .reduce((sum, section) => sum + section.capacity, 0),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toSectionResponse(row: SectionRow): SectionResponseDto {
    return {
      id: row.id,
      name: row.name,
      capacity: row.capacity,
      isActive: row.isActive,
      classId: row.classId,
      division: row.division,
      medium: row.medium,
      classTeacher: row.classTeacher,
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
          resource: 'class',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
