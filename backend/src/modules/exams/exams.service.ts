import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearStatus, ExamStatus, Prisma } from '@prisma/client';

import { type PaginatedResult, buildPaginationMeta } from '@/common/types';
import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type CreateExamDto,
  type CreateExamPaperDto,
  type ExamResponseDto,
  type ListExamsDto,
  type UpdateExamDto,
  type UpdateExamPaperDto,
} from './dto';

export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
}

const examSelect = {
  id: true,
  name: true,
  type: true,
  status: true,
  instructions: true,
  publishedAt: true,
  schoolId: true,
  createdAt: true,
  updatedAt: true,
  class: { select: { id: true, name: true } },
  academicYear: { select: { id: true, name: true } },
  papers: {
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      maxMarks: true,
      passMarks: true,
      venue: true,
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  },
} satisfies Prisma.ExamSelect;

type ExamRow = Prisma.ExamGetPayload<{ select: typeof examSelect }>;

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);
const atUtcMidnight = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

/**
 * Examinations and their schedules.
 *
 * An exam moves DRAFT → PUBLISHED → ARCHIVED and never backwards. The schedule
 * is editable only while it is a draft: once a school has been told when its
 * papers are, a date that changes silently is worse than no date at all.
 */
@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListExamsDto, actor: Actor): Promise<PaginatedResult<ExamResponseDto>> {
    const where: Prisma.ExamWhereInput = {
      ...(actor.isSuperAdmin ? {} : { schoolId: actor.schoolId ?? undefined }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { class: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.exam.count({ where }),
      this.prisma.exam.findMany({
        where,
        select: examSelect,
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

  async findOne(id: string, actor: Actor): Promise<ExamResponseDto> {
    return this.toResponse(await this.getOrThrow(id, actor));
  }

  async create(dto: CreateExamDto, actor: Actor): Promise<ExamResponseDto> {
    const schoolId = this.requireSchool(actor);

    const schoolClass = await this.prisma.schoolClass.findFirst({
      where: { id: dto.classId, schoolId },
      select: { id: true, academicYearId: true },
    });

    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    // Falls back to the class's own year, then to the school's active one — an
    // exam almost always belongs to the session its class belongs to, and
    // making the office restate that is a question with one right answer.
    const academicYearId =
      dto.academicYearId ??
      schoolClass.academicYearId ??
      (
        await this.prisma.academicYear.findFirst({
          where: { schoolId, status: AcademicYearStatus.ACTIVE },
          select: { id: true },
        })
      )?.id ??
      null;

    try {
      const row = await this.prisma.exam.create({
        data: {
          name: dto.name,
          type: dto.type,
          instructions: dto.instructions ?? null,
          classId: dto.classId,
          academicYearId,
          schoolId,
        },
        select: examSelect,
      });

      await this.audit(actor.id, 'exam.created', row.id, { name: row.name, type: row.type });

      return this.toResponse(row);
    } catch (error) {
      throw this.translateNameClash(error, dto.name);
    }
  }

  async update(id: string, dto: UpdateExamDto, actor: Actor): Promise<ExamResponseDto> {
    const existing = await this.getOrThrow(id, actor);

    this.assertDraft(existing, 'edited');

    if (dto.classId && dto.classId !== existing.class.id) {
      // Papers point at subjects, and subjects belong to a class. Moving the
      // exam would leave every paper examining another class's syllabus.
      if (existing.papers.length > 0) {
        throw new ConflictException(
          'Remove the scheduled papers before moving this exam to another class.',
        );
      }

      const schoolClass = await this.prisma.schoolClass.findFirst({
        where: { id: dto.classId, schoolId: existing.schoolId },
        select: { id: true },
      });

      if (!schoolClass) {
        throw new NotFoundException('Class not found');
      }
    }

    try {
      const row = await this.prisma.exam.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          instructions: dto.instructions,
          classId: dto.classId,
          academicYearId: dto.academicYearId,
        },
        select: examSelect,
      });

      await this.audit(actor.id, 'exam.updated', id, { changed: Object.keys(dto) });

      return this.toResponse(row);
    } catch (error) {
      throw this.translateNameClash(error, dto.name ?? existing.name);
    }
  }

  /**
   * Announce it.
   *
   * Refused without papers: an exam nobody can sit is not an announcement, and
   * publishing an empty schedule tells the school nothing while looking like it
   * told them something.
   */
  async publish(id: string, actor: Actor): Promise<ExamResponseDto> {
    const existing = await this.getOrThrow(id, actor);

    if (existing.status === ExamStatus.PUBLISHED) {
      throw new ConflictException('That exam is already published.');
    }

    this.assertDraft(existing, 'published');

    if (existing.papers.length === 0) {
      throw new BadRequestException('Schedule at least one paper before publishing.');
    }

    const row = await this.prisma.exam.update({
      where: { id },
      data: { status: ExamStatus.PUBLISHED, publishedAt: new Date() },
      select: examSelect,
    });

    await this.audit(actor.id, 'exam.published', id, { papers: existing.papers.length });

    return this.toResponse(row);
  }

  /** Close it for good. Terminal — an archived exam cannot come back. */
  async archive(id: string, actor: Actor): Promise<ExamResponseDto> {
    const existing = await this.getOrThrow(id, actor);

    if (existing.status === ExamStatus.ARCHIVED) {
      throw new ConflictException('That exam is already archived.');
    }

    const row = await this.prisma.exam.update({
      where: { id },
      data: { status: ExamStatus.ARCHIVED },
      select: examSelect,
    });

    await this.audit(actor.id, 'exam.archived', id, { from: existing.status });

    return this.toResponse(row);
  }

  /**
   * Deleting is for a draft that should never have existed. Anything the school
   * has been told about is archived instead, so the record survives.
   */
  async remove(id: string, actor: Actor): Promise<void> {
    const existing = await this.getOrThrow(id, actor);

    if (existing.status !== ExamStatus.DRAFT) {
      throw new ConflictException(
        'Only a draft can be deleted. Archive this exam instead — it has been announced.',
      );
    }

    await this.prisma.exam.delete({ where: { id } });

    await this.audit(actor.id, 'exam.deleted', id, { name: existing.name });
  }

  // --- Schedule ------------------------------------------------------------

  async addPaper(examId: string, dto: CreateExamPaperDto, actor: Actor): Promise<ExamResponseDto> {
    const exam = await this.getOrThrow(examId, actor);

    this.assertDraft(exam, 'rescheduled');
    this.assertPaperSane(dto.startTime, dto.endTime, dto.maxMarks, dto.passMarks);
    await this.assertSubjectInClass(dto.subjectId, exam.class.id);

    const clash = exam.papers.find((paper) => paper.subject.id === dto.subjectId);

    if (clash) {
      throw new ConflictException(`${clash.subject.name} is already scheduled for this exam.`);
    }

    await this.prisma.examPaper.create({
      data: {
        examId,
        subjectId: dto.subjectId,
        date: atUtcMidnight(dto.date),
        startTime: dto.startTime,
        endTime: dto.endTime,
        maxMarks: dto.maxMarks,
        passMarks: dto.passMarks,
        venue: dto.venue ?? null,
      },
    });

    await this.audit(actor.id, 'exam.paper_added', examId, { subjectId: dto.subjectId });

    return this.findOne(examId, actor);
  }

  async updatePaper(
    examId: string,
    paperId: string,
    dto: UpdateExamPaperDto,
    actor: Actor,
  ): Promise<ExamResponseDto> {
    const exam = await this.getOrThrow(examId, actor);

    this.assertDraft(exam, 'rescheduled');

    const paper = exam.papers.find((row) => row.id === paperId);

    if (!paper) {
      throw new NotFoundException('That paper is not on this exam.');
    }

    this.assertPaperSane(
      dto.startTime ?? paper.startTime,
      dto.endTime ?? paper.endTime,
      dto.maxMarks ?? paper.maxMarks,
      dto.passMarks ?? paper.passMarks,
    );

    if (dto.subjectId && dto.subjectId !== paper.subject.id) {
      await this.assertSubjectInClass(dto.subjectId, exam.class.id);

      if (exam.papers.some((row) => row.subject.id === dto.subjectId)) {
        throw new ConflictException('That subject already has a paper on this exam.');
      }
    }

    await this.prisma.examPaper.update({
      where: { id: paperId },
      data: {
        subjectId: dto.subjectId,
        ...(dto.date === undefined ? {} : { date: atUtcMidnight(dto.date) }),
        startTime: dto.startTime,
        endTime: dto.endTime,
        maxMarks: dto.maxMarks,
        passMarks: dto.passMarks,
        venue: dto.venue,
      },
    });

    await this.audit(actor.id, 'exam.paper_updated', examId, { paperId });

    return this.findOne(examId, actor);
  }

  async removePaper(examId: string, paperId: string, actor: Actor): Promise<ExamResponseDto> {
    const exam = await this.getOrThrow(examId, actor);

    this.assertDraft(exam, 'rescheduled');

    if (!exam.papers.some((row) => row.id === paperId)) {
      throw new NotFoundException('That paper is not on this exam.');
    }

    await this.prisma.examPaper.delete({ where: { id: paperId } });

    await this.audit(actor.id, 'exam.paper_removed', examId, { paperId });

    return this.findOne(examId, actor);
  }

  // -------------------------------------------------------------------------

  /** The schedule is a draft's to change. Says which act is being refused. */
  private assertDraft(exam: ExamRow, action: string): void {
    if (exam.status === ExamStatus.DRAFT) return;

    throw new ConflictException(
      exam.status === ExamStatus.PUBLISHED
        ? `This exam has been announced, so it cannot be ${action}. Archive it and build a new one if the schedule has to change.`
        : `This exam is archived and cannot be ${action}.`,
    );
  }

  private assertPaperSane(
    startTime: string,
    endTime: string,
    maxMarks: number,
    passMarks: number,
  ): void {
    // Zero-padded HH:mm compares correctly as text — the reason the DTO insists
    // on that format.
    if (endTime <= startTime) {
      throw new BadRequestException('A paper must end after it starts.');
    }

    if (passMarks > maxMarks) {
      throw new BadRequestException('Pass marks cannot exceed the maximum marks.');
    }
  }

  private async assertSubjectInClass(subjectId: string, classId: string): Promise<void> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, classId },
      select: { id: true },
    });

    if (!subject) {
      throw new BadRequestException(
        "That subject is not taught to this exam's class. Choose one from the same class.",
      );
    }
  }

  private translateNameClash(error: unknown, name: string): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(`This class already has an exam called "${name}".`);
    }

    return error;
  }

  private async getOrThrow(id: string, actor: Actor): Promise<ExamRow> {
    const row = await this.prisma.exam.findUnique({ where: { id }, select: examSelect });

    // Out-of-tenant reads 404 rather than 403, so ids do not leak.
    if (!row || (!actor.isSuperAdmin && row.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Exam not found');
    }

    return row;
  }

  private requireSchool(actor: Actor): string {
    if (!actor.schoolId) {
      throw new BadRequestException(
        'Exams belong to a school. The platform operator has none, so it cannot set them.',
      );
    }
    return actor.schoolId;
  }

  private toResponse(row: ExamRow): ExamResponseDto {
    const dates = row.papers.map((paper) => toDateKey(paper.date));

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      classId: row.class.id,
      className: row.class.name,
      academicYearId: row.academicYear?.id ?? null,
      academicYearName: row.academicYear?.name ?? null,
      instructions: row.instructions,
      publishedAt: row.publishedAt,
      paperCount: row.papers.length,
      // Papers come back ordered by date, so the span is the ends of the list.
      startsOn: dates[0] ?? null,
      endsOn: dates[dates.length - 1] ?? null,
      papers: row.papers.map((paper) => ({
        id: paper.id,
        subjectId: paper.subject.id,
        subjectName: paper.subject.name,
        subjectCode: paper.subject.code,
        date: toDateKey(paper.date),
        startTime: paper.startTime,
        endTime: paper.endTime,
        maxMarks: paper.maxMarks,
        passMarks: paper.passMarks,
        venue: paper.venue,
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
          resource: 'exam',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
