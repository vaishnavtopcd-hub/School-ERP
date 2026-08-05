import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { type PaginatedResult, buildPaginationMeta } from '@/common/types';
import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type CreateSubjectDto,
  type ListSubjectsDto,
  type SubjectResponseDto,
  type UpdateSubjectDto,
} from './dto';

/** Identity of the person managing subjects. */
export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
}

const subjectSelect = {
  id: true,
  code: true,
  name: true,
  credits: true,
  isActive: true,
  schoolId: true,
  createdAt: true,
  updatedAt: true,
  class: { select: { id: true, name: true } },
  teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.SubjectSelect;

type SubjectRow = Prisma.SubjectGetPayload<{ select: typeof subjectSelect }>;

/**
 * Subjects taught to a class.
 *
 * Tenancy is enforced the same way as every other module: reads are filtered by
 * the actor's school, and writes resolve the class first so `schoolId` is copied
 * from a row the actor is allowed to see rather than trusted from the client.
 */
@Injectable()
export class SubjectsService {
  private readonly logger = new Logger(SubjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListSubjectsDto, actor: Actor): Promise<PaginatedResult<SubjectResponseDto>> {
    const where: Prisma.SubjectWhereInput = {
      ...(actor.isSuperAdmin ? {} : { schoolId: actor.schoolId ?? undefined }),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };

    if (query.search) {
      // Code and name are what someone types; the class name is what they think
      // in when hunting for "the maths one in Class 9".
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { class: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.subject.count({ where }),
      this.prisma.subject.findMany({
        where,
        select: subjectSelect,
        orderBy: { [query.sortBy ?? 'code']: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toResponse(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string, actor: Actor): Promise<SubjectResponseDto> {
    return this.toResponse(await this.getOrThrow(id, actor));
  }

  async create(dto: CreateSubjectDto, actor: Actor): Promise<SubjectResponseDto> {
    const schoolClass = await this.resolveClass(dto.classId, actor);
    await this.assertTeacherInSchool(dto.teacherId, schoolClass.schoolId);
    await this.assertAvailable(schoolClass.id, dto.code, dto.name);

    const row = await this.prisma.subject.create({
      data: {
        code: dto.code,
        name: dto.name,
        credits: dto.credits ?? 0,
        isActive: dto.isActive ?? true,
        classId: schoolClass.id,
        // Copied from the class rather than taken from the request, so a client
        // cannot plant a subject in another tenant.
        schoolId: schoolClass.schoolId,
        teacherId: dto.teacherId ?? null,
      },
      select: subjectSelect,
    });

    await this.audit(actor.id, 'subject.created', row.id, { code: row.code, name: row.name });

    return this.toResponse(row);
  }

  async update(id: string, dto: UpdateSubjectDto, actor: Actor): Promise<SubjectResponseDto> {
    const existing = await this.getOrThrow(id, actor);

    // Moving a subject to another class re-checks uniqueness against the target.
    const targetClass = dto.classId
      ? await this.resolveClass(dto.classId, actor)
      : { id: existing.class.id, schoolId: existing.schoolId };

    if (dto.teacherId !== undefined) {
      await this.assertTeacherInSchool(dto.teacherId, targetClass.schoolId);
    }

    const nextCode = dto.code ?? existing.code;
    const nextName = dto.name ?? existing.name;
    const classChanged = targetClass.id !== existing.class.id;

    if (classChanged || nextCode !== existing.code || nextName !== existing.name) {
      await this.assertAvailable(targetClass.id, nextCode, nextName, id);
    }

    const row = await this.prisma.subject.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        credits: dto.credits,
        isActive: dto.isActive,
        ...(dto.classId ? { classId: targetClass.id, schoolId: targetClass.schoolId } : {}),
        ...(dto.teacherId === undefined ? {} : { teacherId: dto.teacherId ?? null }),
      },
      select: subjectSelect,
    });

    await this.audit(actor.id, 'subject.updated', id, { changed: Object.keys(dto) });

    return this.toResponse(row);
  }

  /**
   * Hard delete. Unlike a medium, nothing references a subject yet, so there is
   * no dependent data to orphan — `isActive` is still the reversible way to
   * retire one that has history worth keeping.
   */
  async remove(id: string, actor: Actor): Promise<void> {
    const existing = await this.getOrThrow(id, actor);

    await this.prisma.subject.delete({ where: { id } });

    await this.audit(actor.id, 'subject.deleted', id, {
      code: existing.code,
      name: existing.name,
    });
  }

  // -------------------------------------------------------------------------

  /** Resolves a class the actor may actually see, and returns its tenant. */
  private async resolveClass(
    classId: string,
    actor: Actor,
  ): Promise<{ id: string; schoolId: string }> {
    const schoolClass = await this.prisma.schoolClass.findUnique({
      where: { id: classId },
      select: { id: true, schoolId: true },
    });

    // 404 rather than 403 for an out-of-tenant class, so ids do not leak.
    if (!schoolClass || (!actor.isSuperAdmin && schoolClass.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Class not found');
    }

    return schoolClass;
  }

  /**
   * A teacher from another school would be a cross-tenant leak the moment their
   * name rendered in a list, so the assignment is refused rather than ignored.
   */
  private async assertTeacherInSchool(
    teacherId: string | null | undefined,
    schoolId: string,
  ): Promise<void> {
    if (!teacherId) return;

    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, deletedAt: null },
      select: { id: true, schoolId: true },
    });

    if (!teacher || teacher.schoolId !== schoolId) {
      throw new BadRequestException('That teacher is not a member of this school.');
    }
  }

  private async assertAvailable(
    classId: string,
    code: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.prisma.subject.findFirst({
      where: {
        classId,
        OR: [{ code }, { name }],
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { code: true, name: true },
    });

    if (!clash) return;

    throw new ConflictException(
      clash.code === code
        ? `Subject code "${code}" is already used in this class.`
        : `A subject named "${name}" already exists in this class.`,
    );
  }

  private async getOrThrow(id: string, actor: Actor): Promise<SubjectRow> {
    const row = await this.prisma.subject.findUnique({ where: { id }, select: subjectSelect });

    if (!row || (!actor.isSuperAdmin && row.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Subject not found');
    }

    return row;
  }

  private toResponse(row: SubjectRow): SubjectResponseDto {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      credits: row.credits,
      isActive: row.isActive,
      schoolId: row.schoolId,
      class: row.class,
      teacher: row.teacher,
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
          resource: 'subject',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
