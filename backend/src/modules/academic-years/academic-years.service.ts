import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearStatus, Prisma } from '@prisma/client';

import { type PaginatedResult, buildPaginationMeta } from '@/common/types';
import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type AcademicYearResponseDto,
  type ActivateAcademicYearResponseDto,
  type CreateAcademicYearDto,
  type ListAcademicYearsDto,
  type UpdateAcademicYearDto,
} from './dto';

export interface Actor {
  id: string;
  schoolId: string | null;
}

type AcademicYearRow = Prisma.AcademicYearGetPayload<object>;

@Injectable()
export class AcademicYearsService {
  private readonly logger = new Logger(AcademicYearsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async findAll(
    query: ListAcademicYearsDto,
    actor: Actor,
  ): Promise<PaginatedResult<AcademicYearResponseDto>> {
    const where: Prisma.AcademicYearWhereInput = {};

    // A caller bound to a school only ever sees that school. An unscoped admin
    // sees everything unless they ask for one.
    const schoolId = query.schoolId ?? actor.schoolId ?? undefined;
    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.academicYear.count({ where }),
      this.prisma.academicYear.findMany({
        where,
        orderBy: { [query.sortBy ?? 'startDate']: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toResponse(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string): Promise<AcademicYearResponseDto> {
    return this.toResponse(await this.getOrThrow(id));
  }

  /** The school's current session, or null if none has been activated. */
  async findActive(actor: Actor, schoolId?: string): Promise<AcademicYearResponseDto | null> {
    const resolved = this.resolveSchoolId(schoolId, actor);

    const row = await this.prisma.academicYear.findFirst({
      where: { schoolId: resolved, status: AcademicYearStatus.ACTIVE },
    });

    return row ? this.toResponse(row) : null;
  }

  // -------------------------------------------------------------------------
  // Create / update
  // -------------------------------------------------------------------------

  async create(dto: CreateAcademicYearDto, actor: Actor): Promise<AcademicYearResponseDto> {
    const schoolId = this.resolveSchoolId(dto.schoolId, actor);
    const startDate = this.parseDate(dto.startDate);
    const endDate = this.parseDate(dto.endDate);

    this.assertChronological(startDate, endDate);
    await this.assertNameAvailable(schoolId, dto.name);
    await this.assertNoOverlap(schoolId, startDate, endDate);

    const row = await this.prisma.academicYear.create({
      data: {
        name: dto.name,
        startDate,
        endDate,
        schoolId,
        // Always born UPCOMING. Becoming the active year is a separate,
        // separately-permissioned decision.
        status: AcademicYearStatus.UPCOMING,
        activeMarker: null,
      },
    });

    await this.audit(actor.id, 'academic-year.created', row.id, { name: row.name });

    return this.toResponse(row);
  }

  async update(
    id: string,
    dto: UpdateAcademicYearDto,
    actor: Actor,
  ): Promise<AcademicYearResponseDto> {
    const existing = await this.getOrThrow(id);

    if (existing.status === AcademicYearStatus.ARCHIVED) {
      throw new ConflictException('An archived academic year cannot be edited');
    }

    const startDate = dto.startDate ? this.parseDate(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? this.parseDate(dto.endDate) : existing.endDate;

    this.assertChronological(startDate, endDate);

    if (dto.name && dto.name !== existing.name) {
      await this.assertNameAvailable(existing.schoolId, dto.name);
    }

    if (dto.startDate || dto.endDate) {
      await this.assertNoOverlap(existing.schoolId, startDate, endDate, id);
    }

    const row = await this.prisma.academicYear.update({
      where: { id },
      data: { name: dto.name, startDate, endDate },
    });

    await this.audit(actor.id, 'academic-year.updated', id, { changed: Object.keys(dto) });

    return this.toResponse(row);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Makes this the school's active year, archiving whichever year was active
   * before. Both writes happen in one transaction so the school is never left
   * with zero — or two — active years.
   *
   * The archive-then-activate order matters: the unique index on
   * `(schoolId, activeMarker)` is checked per statement, so releasing the old
   * marker has to commit first.
   */
  async activate(id: string, actor: Actor): Promise<ActivateAcademicYearResponseDto> {
    const target = await this.getOrThrow(id);

    if (target.status === AcademicYearStatus.ACTIVE) {
      throw new ConflictException('This academic year is already active');
    }

    if (target.status === AcademicYearStatus.ARCHIVED) {
      throw new ConflictException(
        'An archived academic year cannot be reactivated. Create a new one instead.',
      );
    }

    const current = await this.prisma.academicYear.findFirst({
      where: { schoolId: target.schoolId, status: AcademicYearStatus.ACTIVE },
    });

    const now = new Date();

    try {
      const [, activated] = await this.prisma.$transaction([
        // A no-op when nothing is active yet.
        this.prisma.academicYear.updateMany({
          where: { schoolId: target.schoolId, status: AcademicYearStatus.ACTIVE },
          data: { status: AcademicYearStatus.ARCHIVED, activeMarker: null, archivedAt: now },
        }),
        this.prisma.academicYear.update({
          where: { id },
          data: { status: AcademicYearStatus.ACTIVE, activeMarker: true, archivedAt: null },
        }),
      ]);

      const archived = current
        ? await this.prisma.academicYear.findUnique({ where: { id: current.id } })
        : null;

      await this.audit(actor.id, 'academic-year.activated', id, {
        name: activated.name,
        archivedId: current?.id ?? null,
      });

      return {
        activated: this.toResponse(activated),
        archived: archived ? this.toResponse(archived) : null,
      };
    } catch (error) {
      // The database rejected a second ACTIVE row — another activation won the
      // race between our read and our write.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Another academic year was activated at the same time. Refresh and try again.',
        );
      }
      throw error;
    }
  }

  /** Closes a year for good. Archived years are read-only and cannot reopen. */
  async archive(id: string, actor: Actor): Promise<AcademicYearResponseDto> {
    const target = await this.getOrThrow(id);

    if (target.status === AcademicYearStatus.ARCHIVED) {
      throw new ConflictException('This academic year is already archived');
    }

    const row = await this.prisma.academicYear.update({
      where: { id },
      data: {
        status: AcademicYearStatus.ARCHIVED,
        activeMarker: null,
        archivedAt: new Date(),
      },
    });

    await this.audit(actor.id, 'academic-year.archived', id, {
      name: row.name,
      wasActive: target.status === AcademicYearStatus.ACTIVE,
    });

    return this.toResponse(row);
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  private assertChronological(startDate: Date, endDate: Date): void {
    if (endDate <= startDate) {
      throw new BadRequestException('The end date must fall after the start date');
    }
  }

  private async assertNameAvailable(schoolId: string, name: string): Promise<void> {
    const clash = await this.prisma.academicYear.findFirst({
      where: { schoolId, name },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(`An academic year named "${name}" already exists`);
    }
  }

  /**
   * Two sessions covering the same day would make any dated record — attendance,
   * fees, results — ambiguous about which year it belongs to.
   */
  private async assertNoOverlap(
    schoolId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ): Promise<void> {
    const overlapping = await this.prisma.academicYear.findFirst({
      where: {
        schoolId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        // Inclusive ranges overlap unless one ends before the other begins.
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { name: true, startDate: true, endDate: true },
    });

    if (overlapping) {
      throw new ConflictException(
        `These dates overlap "${overlapping.name}" ` +
          `(${this.formatDate(overlapping.startDate)} to ${this.formatDate(overlapping.endDate)})`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async getOrThrow(id: string): Promise<AcademicYearRow> {
    const row = await this.prisma.academicYear.findUnique({ where: { id } });

    if (!row) {
      throw new NotFoundException('Academic year not found');
    }

    return row;
  }

  private resolveSchoolId(provided: string | undefined, actor: Actor): string {
    const schoolId = provided ?? actor.schoolId;

    if (!schoolId) {
      throw new BadRequestException(
        'No school could be determined. Supply schoolId, or use an account attached to a school.',
      );
    }

    return schoolId;
  }

  /** Anchors a `YYYY-MM-DD` string at UTC midnight so it survives round-tripping. */
  private parseDate(value: string): Date {
    const parsed = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`"${value}" is not a valid date`);
    }

    return parsed;
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toResponse(row: AcademicYearRow): AcademicYearResponseDto {
    const today = this.formatDate(new Date());
    const start = this.formatDate(row.startDate);
    const end = this.formatDate(row.endDate);

    return {
      id: row.id,
      name: row.name,
      startDate: start,
      endDate: end,
      status: row.status,
      schoolId: row.schoolId,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // String comparison is safe and timezone-free for YYYY-MM-DD.
      isCurrent: today >= start && today <= end,
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
          resource: 'academic-year',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
