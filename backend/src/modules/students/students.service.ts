import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StudentStatus } from '@prisma/client';

import { type PaginatedResult, buildPaginationMeta } from '@/common/types';
import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type CreateStudentDto,
  type ListStudentsDto,
  type StudentResponseDto,
  type UpdateStudentDto,
} from './dto';

export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
}

const studentSelect = {
  id: true,
  admissionNo: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
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

  async findAll(query: ListStudentsDto, actor: Actor): Promise<PaginatedResult<StudentResponseDto>> {
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

  async create(dto: CreateStudentDto, actor: Actor): Promise<StudentResponseDto> {
    const schoolId = this.requireSchool(actor);

    await this.assertAdmissionNoAvailable(dto.admissionNo, schoolId);
    const placement = await this.resolvePlacement(dto.classId, dto.sectionId, schoolId);

    const row = await this.prisma.student.create({
      data: {
        admissionNo: dto.admissionNo,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        status: dto.status ?? StudentStatus.ACTIVE,
        schoolId,
        classId: placement.classId,
        sectionId: placement.sectionId,
      },
      select: studentSelect,
    });

    await this.audit(actor.id, 'student.created', row.id, { admissionNo: row.admissionNo });

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

    const row = await this.prisma.student.update({
      where: { id },
      data: {
        admissionNo: dto.admissionNo,
        firstName: dto.firstName,
        lastName: dto.lastName,
        ...(dto.dateOfBirth === undefined
          ? {}
          : { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
        status: dto.status,
        ...(placement ? { classId: placement.classId, sectionId: placement.sectionId } : {}),
      },
      select: studentSelect,
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

  // -------------------------------------------------------------------------

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
