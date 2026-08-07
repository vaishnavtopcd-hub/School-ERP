import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/core/prisma/prisma.service';

import { type CreatePeriodDto, type PeriodResponseDto, type UpdatePeriodDto } from './dto';

export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
}

/**
 * The shape of the school day.
 *
 * One ladder per school, shared by every class — see the `Period` model for why
 * that is not a per-class decision.
 */
@Injectable()
export class PeriodsService {
  private readonly logger = new Logger(PeriodsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: Actor): Promise<PeriodResponseDto[]> {
    const rows = await this.prisma.period.findMany({
      where: actor.isSuperAdmin ? {} : { schoolId: actor.schoolId ?? undefined },
      orderBy: { sequence: 'asc' },
    });

    return rows;
  }

  async create(dto: CreatePeriodDto, actor: Actor): Promise<PeriodResponseDto> {
    const schoolId = this.requireSchool(actor);

    this.assertTimesOrdered(dto.startTime, dto.endTime);

    try {
      const row = await this.prisma.period.create({
        data: {
          name: dto.name,
          sequence: dto.sequence,
          startTime: dto.startTime,
          endTime: dto.endTime,
          isBreak: dto.isBreak ?? false,
          schoolId,
        },
      });

      await this.audit(actor.id, 'period.created', row.id, { name: row.name });

      return row;
    } catch (error) {
      throw this.translateClash(error, dto.name, dto.sequence);
    }
  }

  async update(id: string, dto: UpdatePeriodDto, actor: Actor): Promise<PeriodResponseDto> {
    const existing = await this.getOrThrow(id, actor);

    this.assertTimesOrdered(dto.startTime ?? existing.startTime, dto.endTime ?? existing.endTime);

    try {
      const row = await this.prisma.period.update({ where: { id }, data: { ...dto } });

      await this.audit(actor.id, 'period.updated', id, { changed: Object.keys(dto) });

      return row;
    } catch (error) {
      throw this.translateClash(
        error,
        dto.name ?? existing.name,
        dto.sequence ?? existing.sequence,
      );
    }
  }

  /**
   * Deleting a period deletes the lessons scheduled into it — the FK cascades —
   * so this refuses while any exist rather than quietly emptying the grid.
   */
  async remove(id: string, actor: Actor): Promise<void> {
    const existing = await this.getOrThrow(id, actor);

    const scheduled = await this.prisma.timetableEntry.count({ where: { periodId: id } });

    if (scheduled > 0) {
      throw new ConflictException(
        `"${existing.name}" still has ${scheduled} lesson(s) scheduled in it. Clear them first.`,
      );
    }

    await this.prisma.period.delete({ where: { id } });

    await this.audit(actor.id, 'period.deleted', id, { name: existing.name });
  }

  // -------------------------------------------------------------------------

  private assertTimesOrdered(startTime: string, endTime: string): void {
    // Zero-padded HH:mm compares correctly as text, which is the whole reason
    // for insisting on that format at the DTO.
    if (endTime <= startTime) {
      throw new BadRequestException('A period must end after it starts.');
    }
  }

  private translateClash(error: unknown, name: string, sequence: number): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined) ?? [];

      return new ConflictException(
        target.includes('sequence')
          ? `Another period is already number ${sequence} in the day.`
          : `A period called "${name}" already exists.`,
      );
    }

    return error;
  }

  private async getOrThrow(id: string, actor: Actor) {
    const row = await this.prisma.period.findUnique({ where: { id } });

    // Out-of-tenant reads 404 rather than 403, so ids do not leak.
    if (!row || (!actor.isSuperAdmin && row.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Period not found');
    }

    return row;
  }

  private requireSchool(actor: Actor): string {
    if (!actor.schoolId) {
      throw new BadRequestException(
        'Periods belong to a school. The platform operator has none, so it cannot define them.',
      );
    }
    return actor.schoolId;
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
          resource: 'period',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
