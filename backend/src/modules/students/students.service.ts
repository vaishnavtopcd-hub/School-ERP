import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type GuardianRelationship, Prisma, StudentStatus } from '@prisma/client';

import { type PaginatedResult, buildPaginationMeta } from '@/common/types';
import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type CreateStudentDto,
  type ListStudentsDto,
  type StudentGuardianInputDto,
  type StudentResponseDto,
  type UpdateStudentDto,
} from './dto';

export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
}

interface GuardianLink {
  parentId: string;
  relationship: GuardianRelationship;
  isPrimaryContact: boolean;
}

/** Zero-padded width of a generated admission number's sequence. */
const ADMISSION_NO_WIDTH = 4;

/** How many times a generated number may lose a race before giving up. */
const ADMISSION_NO_ATTEMPTS = 5;

const studentSelect = {
  id: true,
  admissionNo: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  gender: true,
  photoUrl: true,
  bloodGroup: true,
  medicalNotes: true,
  status: true,
  schoolId: true,
  createdAt: true,
  updatedAt: true,
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  guardians: {
    select: {
      relationship: true,
      isPrimaryContact: true,
      parent: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
    orderBy: { isPrimaryContact: 'desc' },
  },
} satisfies Prisma.StudentSelect;

type StudentRow = Prisma.StudentGetPayload<{ select: typeof studentSelect }>;

/**
 * Pupils.
 *
 * Deliberately lean — this exists so guardians have someone to be a guardian
 * *of*. Attendance, fees, documents, and promotion belong to a fuller Students
 * module that extends this rather than replacing it.
 */
@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListStudentsDto,
    actor: Actor,
  ): Promise<PaginatedResult<StudentResponseDto>> {
    const where: Prisma.StudentWhereInput = {
      ...(actor.isSuperAdmin ? {} : { schoolId: actor.schoolId ?? undefined }),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.unlinked ? { guardians: { none: {} } } : {}),
    };

    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      where.OR = [
        { admissionNo: contains },
        { firstName: contains },
        { lastName: contains },
        { class: { name: contains } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        select: studentSelect,
        orderBy: { [query.sortBy ?? 'admissionNo']: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toResponse(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string, actor: Actor): Promise<StudentResponseDto> {
    return this.toResponse(await this.getOrThrow(id, actor));
  }

  /**
   * Enrol a student.
   *
   * `admissionNo` is optional: leave it out and the school's next number for
   * this year is allocated. Guardians can be attached in the same call, so the
   * office fills one form rather than enrolling and then linking.
   */
  async create(dto: CreateStudentDto, actor: Actor): Promise<StudentResponseDto> {
    const schoolId = this.requireSchool(actor);

    if (dto.admissionNo) {
      await this.assertAdmissionNoAvailable(dto.admissionNo, schoolId);
    }

    const placement = await this.resolvePlacement(dto.classId, dto.sectionId, schoolId);
    const guardians = await this.resolveGuardians(dto.guardians, schoolId);

    const row = await this.createWithAdmissionNo(dto.admissionNo, schoolId, (admissionNo) =>
      this.prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            admissionNo,
            firstName: dto.firstName,
            lastName: dto.lastName,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            gender: dto.gender ?? null,
            photoUrl: dto.photoUrl ?? null,
            bloodGroup: dto.bloodGroup ?? null,
            medicalNotes: dto.medicalNotes ?? null,
            status: dto.status ?? StudentStatus.ACTIVE,
            schoolId,
            classId: placement.classId,
            sectionId: placement.sectionId,
          },
          select: { id: true },
        });

        if (guardians.length > 0) {
          await tx.parentStudent.createMany({
            data: guardians.map((guardian) => ({ ...guardian, studentId: student.id })),
          });
        }

        return tx.student.findUniqueOrThrow({ where: { id: student.id }, select: studentSelect });
      }),
    );

    await this.audit(actor.id, 'student.created', row.id, {
      admissionNo: row.admissionNo,
      generated: !dto.admissionNo,
      guardians: guardians.length,
    });

    return this.toResponse(row);
  }

  async update(id: string, dto: UpdateStudentDto, actor: Actor): Promise<StudentResponseDto> {
    const existing = await this.getOrThrow(id, actor);

    if (dto.admissionNo && dto.admissionNo !== existing.admissionNo) {
      await this.assertAdmissionNoAvailable(dto.admissionNo, existing.schoolId, id);
    }

    // Placement is resolved as a pair: changing the class without the section
    // would otherwise leave the student in a section of their previous class.
    const placement =
      dto.classId !== undefined || dto.sectionId !== undefined
        ? await this.resolvePlacement(
            dto.classId === undefined ? (existing.class?.id ?? null) : dto.classId,
            dto.sectionId === undefined ? (existing.section?.id ?? null) : dto.sectionId,
            existing.schoolId,
          )
        : null;

    // Resolved before the write so an unknown guardian fails the whole edit
    // rather than leaving the student half-updated.
    const guardians =
      dto.guardians === undefined
        ? null
        : await this.resolveGuardians(dto.guardians, existing.schoolId);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          admissionNo: dto.admissionNo,
          firstName: dto.firstName,
          lastName: dto.lastName,
          ...(dto.dateOfBirth === undefined
            ? {}
            : { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
          gender: dto.gender,
          photoUrl: dto.photoUrl,
          bloodGroup: dto.bloodGroup,
          medicalNotes: dto.medicalNotes,
          status: dto.status,
          ...(placement ? { classId: placement.classId, sectionId: placement.sectionId } : {}),
        },
      });

      // Sent means "this is the whole set now": anyone left out is unlinked.
      // Omitting the field leaves the links untouched, which is what an edit
      // that never showed them should do.
      if (guardians) {
        await tx.parentStudent.deleteMany({
          where: { studentId: id, parentId: { notIn: guardians.map((row) => row.parentId) } },
        });

        for (const guardian of guardians) {
          await tx.parentStudent.upsert({
            where: { parentId_studentId: { parentId: guardian.parentId, studentId: id } },
            create: { ...guardian, studentId: id },
            update: {
              relationship: guardian.relationship,
              isPrimaryContact: guardian.isPrimaryContact,
            },
          });
        }
      }

      return tx.student.findUniqueOrThrow({ where: { id }, select: studentSelect });
    });

    await this.audit(actor.id, 'student.updated', id, { changed: Object.keys(dto) });

    return this.toResponse(row);
  }

  /**
   * Guardian links go with them — the link is meaningless without the student,
   * and the guardians themselves are users who survive untouched.
   */
  async remove(id: string, actor: Actor): Promise<void> {
    const existing = await this.getOrThrow(id, actor);

    await this.prisma.student.delete({ where: { id } });

    await this.audit(actor.id, 'student.deleted', id, { admissionNo: existing.admissionNo });
  }

  /** What enrolling right now would be given. Advisory — see the DTO. */
  async nextAdmissionNo(actor: Actor): Promise<string> {
    return this.generateAdmissionNo(this.requireSchool(actor));
  }

  // -------------------------------------------------------------------------

  /**
   * Runs the enrolment, allocating a number first when the caller gave none.
   *
   * Two enrolments a moment apart read the same highest number, so a generated
   * one can lose to a unique-constraint violation. The index is the arbiter:
   * rather than lock the table for a number nobody has asked for yet, this
   * takes the loss and tries the next one.
   */
  private async createWithAdmissionNo<T>(
    explicit: string | undefined,
    schoolId: string,
    run: (admissionNo: string) => Promise<T>,
  ): Promise<T> {
    if (explicit) {
      return run(explicit);
    }

    for (let attempt = 1; attempt <= ADMISSION_NO_ATTEMPTS; attempt += 1) {
      try {
        return await run(await this.generateAdmissionNo(schoolId));
      } catch (error) {
        const clash =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

        if (!clash || attempt === ADMISSION_NO_ATTEMPTS) {
          throw error;
        }

        this.logger.warn(`Admission number taken mid-enrolment; retrying (${attempt})`);
      }
    }

    // Unreachable: the loop either returns or throws.
    throw new ConflictException('Could not allocate an admission number. Try again.');
  }

  /**
   * `ADM-<year>-<sequence>`, continuing the school's highest number for the
   * current year. Numbers entered by hand in another format are ignored rather
   * than reinterpreted — a school mid-migration keeps both.
   */
  private async generateAdmissionNo(schoolId: string): Promise<string> {
    const prefix = `ADM-${new Date().getFullYear()}-`;

    const existing = await this.prisma.student.findMany({
      where: { schoolId, admissionNo: { startsWith: prefix } },
      select: { admissionNo: true },
    });

    // Compared as numbers, not text: "ADM-2026-10000" sorts *below*
    // "ADM-2026-9999" lexically, so ordering this in the query would hand back
    // a number that is already taken.
    const highest = existing.reduce((max, row) => {
      const sequence = Number(row.admissionNo.slice(prefix.length));
      return Number.isInteger(sequence) && sequence > max ? sequence : max;
    }, 0);

    return `${prefix}${String(highest + 1).padStart(ADMISSION_NO_WIDTH, '0')}`;
  }

  /**
   * Checks every guardian is one of this school's, and that the payload obeys
   * the one-primary-contact rule before any of it is written.
   */
  private async resolveGuardians(
    input: StudentGuardianInputDto[] | undefined,
    schoolId: string,
  ): Promise<GuardianLink[]> {
    if (!input || input.length === 0) {
      return [];
    }

    const parentIds = input.map((guardian) => guardian.parentId);

    if (new Set(parentIds).size !== parentIds.length) {
      throw new BadRequestException('The same guardian is listed twice.');
    }

    if (input.filter((guardian) => guardian.isPrimaryContact).length > 1) {
      throw new BadRequestException('Only one guardian can be the primary contact.');
    }

    const found = await this.prisma.user.findMany({
      where: {
        id: { in: parentIds },
        deletedAt: null,
        // A guardian is a user with a guardian record — an ordinary account
        // cannot be linked, the same rule POST /parents/:id/students applies.
        parentProfile: { isNot: null },
        schoolId,
      },
      select: { id: true },
    });

    if (found.length !== parentIds.length) {
      throw new NotFoundException(
        'One or more of those guardians is not recorded as a guardian in this school.',
      );
    }

    return input.map((guardian) => ({
      parentId: guardian.parentId,
      relationship: guardian.relationship,
      isPrimaryContact: guardian.isPrimaryContact ?? false,
    }));
  }

  private requireSchool(actor: Actor): string {
    if (!actor.schoolId) {
      throw new BadRequestException(
        'Students belong to a school. The platform operator has none, so it cannot enrol them.',
      );
    }
    return actor.schoolId;
  }

  /** Validates the class/section pair, and that the section is in the class. */
  private async resolvePlacement(
    classId: string | null | undefined,
    sectionId: string | null | undefined,
    schoolId: string,
  ): Promise<{ classId: string | null; sectionId: string | null }> {
    if (!classId) {
      if (sectionId) {
        throw new BadRequestException('Choose a class before choosing a section.');
      }
      return { classId: null, sectionId: null };
    }

    const schoolClass = await this.prisma.schoolClass.findFirst({
      where: { id: classId, schoolId },
      select: { id: true },
    });

    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    if (!sectionId) {
      return { classId, sectionId: null };
    }

    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, classId },
      select: { id: true },
    });

    if (!section) {
      throw new BadRequestException('That section does not belong to the chosen class.');
    }

    return { classId, sectionId };
  }

  private async assertAdmissionNoAvailable(
    admissionNo: string,
    schoolId: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.prisma.student.findFirst({
      where: { schoolId, admissionNo, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(`Admission number "${admissionNo}" is already used.`);
    }
  }

  private async getOrThrow(id: string, actor: Actor): Promise<StudentRow> {
    const row = await this.prisma.student.findUnique({ where: { id }, select: studentSelect });

    // Out-of-tenant reads 404 rather than 403, so ids do not leak.
    if (!row || (!actor.isSuperAdmin && row.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Student not found');
    }

    return row;
  }

  private toResponse(row: StudentRow): StudentResponseDto {
    return {
      id: row.id,
      admissionNo: row.admissionNo,
      firstName: row.firstName,
      lastName: row.lastName,
      // Date-only column: trimmed so it never carries a timezone the school did
      // not mean, matching how academic-year dates are handled.
      dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : null,
      gender: row.gender,
      photoUrl: row.photoUrl,
      bloodGroup: row.bloodGroup,
      medicalNotes: row.medicalNotes,
      status: row.status,
      schoolId: row.schoolId,
      classId: row.class?.id ?? null,
      className: row.class?.name ?? null,
      sectionId: row.section?.id ?? null,
      sectionName: row.section?.name ?? null,
      guardians: row.guardians.map((link) => ({
        id: link.parent.id,
        firstName: link.parent.firstName,
        lastName: link.parent.lastName,
        phone: link.parent.phone,
        relationship: link.relationship,
        isPrimaryContact: link.isPrimaryContact,
      })),
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
          resource: 'student',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
