import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type DayOfWeek, Prisma } from '@prisma/client';

import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type CreateTimetableEntryDto,
  type TimetableEntryResponseDto,
  type UpdateTimetableEntryDto,
  type WeeklyTimetableDto,
  type WeeklyTimetableQueryDto,
} from './dto';
import { type Actor } from './periods.service';

const entrySelect = {
  id: true,
  day: true,
  createdAt: true,
  updatedAt: true,
  period: { select: { id: true, name: true, sequence: true } },
  section: {
    select: { id: true, name: true, division: true, class: { select: { id: true, name: true } } },
  },
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.TimetableEntrySelect;

type EntryRow = Prisma.TimetableEntryGetPayload<{ select: typeof entrySelect }>;

/** Every day the grid can hold, in the order a week is read. */
const WEEK: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

/**
 * Lessons on the grid.
 *
 * Two rules govern every write, and both are also unique indexes:
 *   - a section cannot be taught two subjects at once (the classroom clash)
 *   - a teacher cannot be in two rooms at once (the teacher clash)
 *
 * They are checked here so the failure names the lesson in the way, and
 * enforced by the database so two simultaneous requests cannot both pass the
 * check and then both write.
 */
@Injectable()
export class TimetableService {
  private readonly logger = new Logger(TimetableService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * A whole week, for a section or for a teacher.
   *
   * The period ladder comes along because the grid cannot be drawn without it.
   */
  async weekly(query: WeeklyTimetableQueryDto, actor: Actor): Promise<WeeklyTimetableDto> {
    if (Boolean(query.sectionId) === Boolean(query.teacherId)) {
      throw new BadRequestException('Ask for either a section or a teacher, not both or neither.');
    }

    const schoolId = this.tenantFilter(actor);

    const [periods, rows] = await this.prisma.$transaction([
      this.prisma.period.findMany({ where: schoolId, orderBy: { sequence: 'asc' } }),
      this.prisma.timetableEntry.findMany({
        where: {
          ...schoolId,
          ...(query.sectionId ? { sectionId: query.sectionId } : {}),
          ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        },
        select: entrySelect,
        orderBy: [{ period: { sequence: 'asc' } }],
      }),
    ]);

    return {
      periods,
      days: WEEK,
      entries: rows.map((row) => this.toResponse(row)),
    };
  }

  async create(dto: CreateTimetableEntryDto, actor: Actor): Promise<TimetableEntryResponseDto> {
    const schoolId = this.requireSchool(actor);

    await this.assertAssignable(dto, schoolId);
    await this.assertNoClash(dto.day, dto.periodId, dto.sectionId, dto.teacherId, schoolId);

    try {
      const row = await this.prisma.timetableEntry.create({
        data: {
          day: dto.day,
          periodId: dto.periodId,
          sectionId: dto.sectionId,
          subjectId: dto.subjectId,
          teacherId: dto.teacherId,
          schoolId,
        },
        select: entrySelect,
      });

      await this.audit(actor.id, 'timetable.created', row.id, {
        day: dto.day,
        sectionId: dto.sectionId,
        teacherId: dto.teacherId,
      });

      return this.toResponse(row);
    } catch (error) {
      throw this.translateRace(error);
    }
  }

  async update(
    id: string,
    dto: UpdateTimetableEntryDto,
    actor: Actor,
  ): Promise<TimetableEntryResponseDto> {
    const existing = await this.getOrThrow(id, actor);

    // Merged first: moving a lesson to another day has to be checked against
    // where it is going, not a mixture of old and new.
    const next = {
      day: dto.day ?? existing.day,
      periodId: dto.periodId ?? existing.period.id,
      sectionId: dto.sectionId ?? existing.section.id,
      subjectId: dto.subjectId ?? existing.subject.id,
      teacherId: dto.teacherId ?? existing.teacher.id,
    };

    const schoolId = this.requireSchool(actor);

    await this.assertAssignable(next, schoolId);
    await this.assertNoClash(next.day, next.periodId, next.sectionId, next.teacherId, schoolId, id);

    try {
      const row = await this.prisma.timetableEntry.update({
        where: { id },
        data: next,
        select: entrySelect,
      });

      await this.audit(actor.id, 'timetable.updated', id, { changed: Object.keys(dto) });

      return this.toResponse(row);
    } catch (error) {
      throw this.translateRace(error);
    }
  }

  async remove(id: string, actor: Actor): Promise<void> {
    await this.getOrThrow(id, actor);

    await this.prisma.timetableEntry.delete({ where: { id } });

    await this.audit(actor.id, 'timetable.deleted', id, {});
  }

  // -------------------------------------------------------------------------

  /**
   * Everything about a lesson that is true regardless of when it is scheduled:
   * the pieces exist, belong to this school, and belong together.
   */
  private async assertAssignable(
    dto: Pick<CreateTimetableEntryDto, 'periodId' | 'sectionId' | 'subjectId' | 'teacherId'>,
    schoolId: string,
  ): Promise<void> {
    const [period, section, subject, teacher] = await Promise.all([
      this.prisma.period.findFirst({
        where: { id: dto.periodId, schoolId },
        select: { id: true, name: true, isBreak: true },
      }),
      this.prisma.section.findFirst({
        where: { id: dto.sectionId, class: { schoolId } },
        select: { id: true, classId: true },
      }),
      this.prisma.subject.findFirst({
        where: { id: dto.subjectId, schoolId },
        select: { id: true, classId: true, name: true },
      }),
      this.prisma.user.findFirst({
        // A teacher is a user with a teaching record, the same rule the
        // teachers module applies.
        where: { id: dto.teacherId, deletedAt: null, schoolId, teacherProfile: { isNot: null } },
        select: { id: true },
      }),
    ]);

    if (!period) throw new NotFoundException('Period not found');
    if (!section) throw new NotFoundException('Section not found');
    if (!subject) throw new NotFoundException('Subject not found');
    if (!teacher) {
      throw new NotFoundException('That teacher is not recorded as teaching staff in this school.');
    }

    if (period.isBreak) {
      throw new BadRequestException(
        `"${period.name}" is a break — nothing can be scheduled in it.`,
      );
    }

    // Subjects belong to a class, sections belong to a class. A subject from
    // another class on this section's grid would be a quiet mistake, so it is
    // refused rather than stored.
    if (subject.classId !== section.classId) {
      throw new BadRequestException(
        `"${subject.name}" is not taught to that section's class. Choose a subject from the same class.`,
      );
    }
  }

  /**
   * The two clash rules, phrased as sentences.
   *
   * Both queries name what is in the way, because "that teacher is busy" is
   * only useful if it also says what they are doing.
   */
  private async assertNoClash(
    day: DayOfWeek,
    periodId: string,
    sectionId: string,
    teacherId: string,
    schoolId: string,
    exceptId?: string,
  ): Promise<void> {
    const except = exceptId ? { NOT: { id: exceptId } } : {};

    const [sectionClash, teacherClash] = await Promise.all([
      this.prisma.timetableEntry.findFirst({
        where: { schoolId, day, periodId, sectionId, ...except },
        select: { subject: { select: { name: true } } },
      }),
      this.prisma.timetableEntry.findFirst({
        where: { schoolId, day, periodId, teacherId, ...except },
        select: {
          subject: { select: { name: true } },
          section: { select: { name: true, class: { select: { name: true } } } },
        },
      }),
    ]);

    if (sectionClash) {
      throw new ConflictException(
        `That section already has ${sectionClash.subject.name} in this period.`,
      );
    }

    if (teacherClash) {
      throw new ConflictException(
        `That teacher is already taking ${teacherClash.subject.name} with ` +
          `${teacherClash.section.class.name} ${teacherClash.section.name} in this period.`,
      );
    }
  }

  /**
   * The indexes catching what the checks above could not: two requests that
   * both passed, a moment apart. Rarer than the checked path and less specific,
   * because by now the winning row is somebody else's.
   */
  private translateRace(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined) ?? [];

      return new ConflictException(
        target.includes('teacher_id')
          ? 'That teacher was booked for this period a moment ago. Reload and try again.'
          : 'That slot was filled a moment ago. Reload and try again.',
      );
    }

    return error;
  }

  private async getOrThrow(id: string, actor: Actor): Promise<EntryRow & { schoolId: string }> {
    const row = await this.prisma.timetableEntry.findUnique({
      where: { id },
      select: { ...entrySelect, schoolId: true },
    });

    if (!row || (!actor.isSuperAdmin && row.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Timetable entry not found');
    }

    return row;
  }

  private tenantFilter(actor: Actor): { schoolId?: string } {
    return actor.isSuperAdmin ? {} : { schoolId: actor.schoolId ?? undefined };
  }

  private requireSchool(actor: Actor): string {
    if (!actor.schoolId) {
      throw new BadRequestException(
        'Timetables belong to a school. The platform operator has none, so it cannot build one.',
      );
    }
    return actor.schoolId;
  }

  private toResponse(row: EntryRow): TimetableEntryResponseDto {
    return {
      id: row.id,
      day: row.day,
      periodId: row.period.id,
      periodName: row.period.name,
      sectionId: row.section.id,
      sectionName: row.section.division
        ? `${row.section.name} — ${row.section.division}`
        : row.section.name,
      classId: row.section.class.id,
      className: row.section.class.name,
      subjectId: row.subject.id,
      subjectName: row.subject.name,
      subjectCode: row.subject.code,
      teacherId: row.teacher.id,
      teacherName: `${row.teacher.firstName} ${row.teacher.lastName}`,
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
          resource: 'timetable',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
