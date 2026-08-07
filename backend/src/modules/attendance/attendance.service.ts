import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, Prisma, StudentStatus } from '@prisma/client';

import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type AttendanceCountsDto,
  type AttendanceOverviewDto,
  type DailyRegisterDto,
  type DailyRegisterQueryDto,
  type MarkAttendanceDto,
  type MonthlyReportDto,
  type MonthlyReportQueryDto,
  type StudentAttendanceDto,
} from './dto';

export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
}

/**
 * A date-only column is stored at midnight UTC, so every date this module reads
 * or writes is built the same way. Using `new Date('2026-08-07')` directly is
 * the same thing, but going through here makes the intent explicit and keeps
 * the local-timezone constructor from creeping in.
 */
const atUtcMidnight = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

/** Back to `YYYY-MM-DD`, which is what every response speaks. */
const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

/** First and last instant of a `YYYY-MM` month, as a Prisma range filter. */
function monthRange(month: string): { gte: Date; lte: Date } {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
    // Day 0 of the next month is the last day of this one.
    lte: new Date(Date.UTC(year, monthNumber, 0)),
  };
}

const currentMonth = (): string => new Date().toISOString().slice(0, 7);

function emptyCounts(): AttendanceCountsDto {
  return { present: 0, absent: 0, leave: 0, late: 0, marked: 0, percentage: null };
}

/**
 * Tallies one student's marks.
 *
 * LATE counts towards attendance — a child who arrived is at school — but is
 * still reported on its own, which is why the enum keeps them apart.
 */
function tally(statuses: AttendanceStatus[]): AttendanceCountsDto {
  const counts = emptyCounts();

  for (const status of statuses) {
    if (status === AttendanceStatus.PRESENT) counts.present += 1;
    if (status === AttendanceStatus.ABSENT) counts.absent += 1;
    if (status === AttendanceStatus.LEAVE) counts.leave += 1;
    if (status === AttendanceStatus.LATE) counts.late += 1;
  }

  counts.marked = statuses.length;
  counts.percentage =
    counts.marked === 0
      ? null
      : Math.round(((counts.present + counts.late) / counts.marked) * 1000) / 10;

  return counts;
}

/**
 * The daily register.
 *
 * Everything here is per student per day: one mark, corrected by re-marking
 * rather than by a second row. The reports are that table read three ways —
 * a section's day, a section's month, and one student's month.
 */
@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every section, and how far its register has got for one day.
   *
   * The landing screen: a school takes attendance section by section, so the
   * first question is which ones are still outstanding — not which student.
   */
  async overview(date: string | undefined, actor: Actor): Promise<AttendanceOverviewDto> {
    const on = date ?? toDateKey(new Date());
    const schoolFilter = actor.isSuperAdmin ? {} : { schoolId: actor.schoolId ?? undefined };

    const [sections, students, records] = await this.prisma.$transaction([
      this.prisma.section.findMany({
        where: {
          class: schoolFilter,
          // Retired sections are hidden, *unless* students are still in one.
          // A child nobody can mark is worse than a stale row: the register
          // would silently have no way to account for them.
          OR: [{ isActive: true }, { students: { some: { status: StudentStatus.ACTIVE } } }],
        },
        select: {
          id: true,
          name: true,
          division: true,
          isActive: true,
          class: { select: { id: true, name: true, level: true } },
        },
        orderBy: [{ class: { level: 'asc' } }, { name: 'asc' }],
      }),
      // One query for the whole school and tallied below, rather than a count
      // per section — forty sections would otherwise be forty round trips for
      // forty integers. Only the section id is selected, so the rows are tiny.
      this.prisma.student.findMany({
        where: { status: StudentStatus.ACTIVE, sectionId: { not: null }, ...schoolFilter },
        select: { sectionId: true },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { date: atUtcMidnight(on), ...schoolFilter },
        select: { sectionId: true, status: true },
      }),
    ]);

    const rosterSize = new Map<string, number>();
    for (const student of students) {
      if (!student.sectionId) continue;
      rosterSize.set(student.sectionId, (rosterSize.get(student.sectionId) ?? 0) + 1);
    }

    const marked = new Map<string, { total: number; away: number }>();
    for (const record of records) {
      if (!record.sectionId) continue;
      const entry = marked.get(record.sectionId) ?? { total: 0, away: 0 };
      entry.total += 1;
      if (record.status !== AttendanceStatus.PRESENT) entry.away += 1;
      marked.set(record.sectionId, entry);
    }

    return {
      date: on,
      sections: sections.map((section) => {
        const size = rosterSize.get(section.id) ?? 0;
        const tally = marked.get(section.id) ?? { total: 0, away: 0 };

        return {
          sectionId: section.id,
          classId: section.class.id,
          className: section.class.name,
          sectionName: section.division ? `${section.name} — ${section.division}` : section.name,
          isActive: section.isActive,
          students: size,
          marked: tally.total,
          // An empty section is not "complete"; it has nothing to complete.
          isComplete: size > 0 && tally.total >= size,
          away: tally.away,
        };
      }),
    };
  }

  /**
   * The register to fill in: every enrolled student in the section, carrying
   * their mark for that date if one exists.
   *
   * Built from the roster rather than from the attendance table, so a day
   * nobody has touched still comes back as a full list of names to mark.
   */
  async dailyRegister(query: DailyRegisterQueryDto, actor: Actor): Promise<DailyRegisterDto> {
    const section = await this.getSectionOrThrow(query.sectionId, actor);
    const date = atUtcMidnight(query.date);

    const [students, records] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where: { sectionId: section.id, status: StudentStatus.ACTIVE },
        select: {
          id: true,
          admissionNo: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
        },
        orderBy: { admissionNo: 'asc' },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { sectionId: section.id, date },
        select: { studentId: true, status: true, remarks: true },
      }),
    ]);

    const marks = new Map(records.map((record) => [record.studentId, record]));

    const rows = students.map((student) => {
      const mark = marks.get(student.id);
      return {
        studentId: student.id,
        admissionNo: student.admissionNo,
        firstName: student.firstName,
        lastName: student.lastName,
        photoUrl: student.photoUrl,
        status: mark?.status ?? null,
        remarks: mark?.remarks ?? null,
      };
    });

    return {
      date: query.date,
      sectionId: section.id,
      className: section.class.name,
      sectionName: section.name,
      isComplete: rows.length > 0 && rows.every((row) => row.status !== null),
      students: rows,
    };
  }

  /**
   * Take the register.
   *
   * One transaction: a half-marked class is worse than an unmarked one, since
   * the missing names look like students nobody has decided about.
   */
  async mark(dto: MarkAttendanceDto, actor: Actor): Promise<DailyRegisterDto> {
    const section = await this.getSectionOrThrow(dto.sectionId, actor);
    const date = atUtcMidnight(dto.date);

    // Tomorrow's register cannot be known. Compared as date-only, so marking
    // today is allowed for the whole of today wherever the reader is.
    if (toDateKey(date) > toDateKey(new Date())) {
      throw new BadRequestException('Attendance cannot be marked for a future date.');
    }

    const studentIds = dto.records.map((record) => record.studentId);

    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException('The same student appears twice in this register.');
    }

    const enrolled = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, sectionId: section.id },
      select: { id: true },
    });

    if (enrolled.length !== studentIds.length) {
      throw new BadRequestException(
        'One or more of those students is not in this section. Reload the register and try again.',
      );
    }

    await this.prisma.$transaction(
      dto.records.map((record) =>
        this.prisma.attendanceRecord.upsert({
          where: { studentId_date: { studentId: record.studentId, date } },
          create: {
            date,
            status: record.status,
            remarks: record.remarks ?? null,
            studentId: record.studentId,
            sectionId: section.id,
            markedById: actor.id,
            schoolId: section.class.schoolId,
          },
          update: {
            status: record.status,
            remarks: record.remarks ?? null,
            // Whoever corrected it owns it now — the register should name the
            // person who last said this was true.
            markedById: actor.id,
            sectionId: section.id,
          },
        }),
      ),
    );

    await this.audit(actor.id, 'attendance.marked', section.id, {
      date: dto.date,
      students: dto.records.length,
    });

    return this.dailyRegister({ sectionId: section.id, date: dto.date }, actor);
  }

  /**
   * Erase a day's register for one section.
   *
   * For a day marked by mistake — the wrong date, the wrong section. Correcting
   * a mark is re-marking; this is for a register that should not exist at all,
   * which re-marking cannot express because "no answer" is not one of the four
   * statuses.
   */
  async clearDay(query: DailyRegisterQueryDto, actor: Actor): Promise<{ cleared: number }> {
    const section = await this.getSectionOrThrow(query.sectionId, actor);

    const { count } = await this.prisma.attendanceRecord.deleteMany({
      where: { sectionId: section.id, date: atUtcMidnight(query.date) },
    });

    await this.audit(actor.id, 'attendance.day_cleared', section.id, {
      date: query.date,
      cleared: count,
    });

    return { cleared: count };
  }

  /** A section's month: a row per student, with their marks and their tally. */
  async monthlyReport(query: MonthlyReportQueryDto, actor: Actor): Promise<MonthlyReportDto> {
    const section = await this.getSectionOrThrow(query.sectionId, actor);

    const [students, records] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where: { sectionId: section.id, status: StudentStatus.ACTIVE },
        select: { id: true, admissionNo: true, firstName: true, lastName: true },
        orderBy: { admissionNo: 'asc' },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { sectionId: section.id, date: monthRange(query.month) },
        select: { studentId: true, date: true, status: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const byStudent = new Map<string, { date: string; status: AttendanceStatus }[]>();
    const dates = new Set<string>();

    for (const record of records) {
      const key = toDateKey(record.date);
      dates.add(key);
      const list = byStudent.get(record.studentId) ?? [];
      list.push({ date: key, status: record.status });
      byStudent.set(record.studentId, list);
    }

    return {
      month: query.month,
      sectionId: section.id,
      className: section.class.name,
      sectionName: section.name,
      // Only days that were actually taken. A month of columns for a school
      // that marks three days a week would read as a wall of gaps.
      dates: [...dates].sort(),
      students: students.map((student) => {
        const marks = byStudent.get(student.id) ?? [];

        return {
          studentId: student.id,
          admissionNo: student.admissionNo,
          firstName: student.firstName,
          lastName: student.lastName,
          counts: tally(marks.map((mark) => mark.status)),
          byDate: Object.fromEntries(marks.map((mark) => [mark.date, mark.status])),
        };
      }),
    };
  }

  /** One student's month. Staff route — scoped to the caller's school. */
  async studentMonth(
    studentId: string,
    month: string | undefined,
    actor: Actor,
  ): Promise<StudentAttendanceDto> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        admissionNo: true,
        firstName: true,
        lastName: true,
        schoolId: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });

    if (!student || (!actor.isSuperAdmin && student.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Student not found');
    }

    return this.buildStudentMonth(student, month ?? currentMonth());
  }

  /**
   * A guardian's own children.
   *
   * Scoped by the guardian link and nothing else: what the caller may see is
   * derived from who they are, never from an id they supplied. `attendance:
   * read-own` gets you in the door; it does not choose whose door.
   */
  async myChildren(month: string | undefined, actor: Actor): Promise<StudentAttendanceDto[]> {
    const links = await this.prisma.parentStudent.findMany({
      where: { parentId: actor.id },
      select: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            firstName: true,
            lastName: true,
            schoolId: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
      orderBy: { student: { firstName: 'asc' } },
    });

    return Promise.all(
      links.map((link) => this.buildStudentMonth(link.student, month ?? currentMonth())),
    );
  }

  /**
   * One student's month, for a caller who has already been shown to be allowed
   * to see it. Deliberately takes the student rather than an id: the check
   * belongs to the caller, and this cannot be reached without having made it.
   */
  private async buildStudentMonth(
    student: {
      id: string;
      admissionNo: string;
      firstName: string;
      lastName: string;
      class: { name: string } | null;
      section: { name: string } | null;
    },
    month: string,
  ): Promise<StudentAttendanceDto> {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId: student.id, date: monthRange(month) },
      select: { date: true, status: true, remarks: true },
      orderBy: { date: 'asc' },
    });

    return {
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      admissionNo: student.admissionNo,
      className: student.class?.name ?? null,
      sectionName: student.section?.name ?? null,
      month,
      counts: tally(records.map((record) => record.status)),
      days: records.map((record) => ({
        date: toDateKey(record.date),
        status: record.status,
        remarks: record.remarks,
      })),
    };
  }

  // -------------------------------------------------------------------------

  private async getSectionOrThrow(sectionId: string, actor: Actor) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: {
        id: true,
        name: true,
        class: { select: { name: true, schoolId: true } },
      },
    });

    // Out-of-tenant reads 404 rather than 403, so ids do not leak.
    if (!section || (!actor.isSuperAdmin && section.class.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Section not found');
    }

    if (!actor.schoolId && !actor.isSuperAdmin) {
      throw new ForbiddenException('Attendance belongs to a school.');
    }

    return section;
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
          resource: 'attendance',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
