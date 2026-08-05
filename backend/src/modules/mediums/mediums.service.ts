import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma } from '@prisma/client';

import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type CreateMediumDto,
  type MediumResponseDto,
  type UpdateMediumDto,
} from './dto';

/** Identity of the administrator managing mediums. */
export interface Actor {
  id: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
}

const mediumSelect = {
  id: true,
  name: true,
  isActive: true,
  schoolId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { sections: true } },
} satisfies Prisma.MediumSelect;

type MediumRow = Prisma.MediumGetPayload<{ select: typeof mediumSelect }>;

/**
 * Languages of instruction, owned per school.
 *
 * Sections point at a row here rather than storing a string, so renaming
 * "Malayalam" corrects every section at once instead of leaving stale copies.
 */
@Injectable()
export class MediumsService {
  private readonly logger = new Logger(MediumsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: Actor, activeOnly = false): Promise<MediumResponseDto[]> {
    const rows = await this.prisma.medium.findMany({
      where: {
        ...(actor.isSuperAdmin ? {} : { schoolId: actor.schoolId ?? undefined }),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { name: 'asc' },
      select: mediumSelect,
    });

    return rows.map((row) => this.toResponse(row));
  }

  async findOne(id: string, actor: Actor): Promise<MediumResponseDto> {
    return this.toResponse(await this.getOrThrow(id, actor));
  }

  async create(dto: CreateMediumDto, actor: Actor): Promise<MediumResponseDto> {
    const schoolId = this.requireSchool(actor);
    await this.assertNameAvailable(dto.name, schoolId);

    const row = await this.prisma.medium.create({
      data: { name: dto.name, isActive: dto.isActive ?? true, schoolId },
      select: mediumSelect,
    });

    await this.audit(actor.id, 'medium.created', row.id, { name: row.name });

    return this.toResponse(row);
  }

  async update(id: string, dto: UpdateMediumDto, actor: Actor): Promise<MediumResponseDto> {
    const existing = await this.getOrThrow(id, actor);

    if (dto.name && dto.name !== existing.name) {
      await this.assertNameAvailable(dto.name, existing.schoolId);
    }

    const row = await this.prisma.medium.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive },
      select: mediumSelect,
    });

    await this.audit(actor.id, 'medium.updated', id, { changed: Object.keys(dto) });

    return this.toResponse(row);
  }

  /**
   * Refused while sections still use it.
   *
   * The foreign key is `SetNull`, so deleting would silently blank the medium
   * on every section that had it — a quiet data change rather than a decision
   * someone made. Deactivating is the reversible way to retire one.
   */
  async remove(id: string, actor: Actor): Promise<void> {
    const existing = await this.getOrThrow(id, actor);

    if (existing._count.sections > 0) {
      throw new ConflictException(
        `${existing._count.sections} section(s) are taught in "${existing.name}". ` +
          'Reassign them, or deactivate this medium instead.',
      );
    }

    await this.prisma.medium.delete({ where: { id } });

    await this.audit(actor.id, 'medium.deleted', id, { name: existing.name });
  }

  private requireSchool(actor: Actor): string {
    if (!actor.schoolId) {
      throw new BadRequestException(
        'Mediums belong to a school. The platform operator has none, so it cannot create them.',
      );
    }
    return actor.schoolId;
  }

  private async assertNameAvailable(name: string, schoolId: string): Promise<void> {
    const clash = await this.prisma.medium.findFirst({
      where: { name, schoolId },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(`A medium named "${name}" already exists in this school`);
    }
  }

  private async getOrThrow(id: string, actor: Actor): Promise<MediumRow> {
    const row = await this.prisma.medium.findUnique({ where: { id }, select: mediumSelect });

    // Out-of-tenant reads 404 rather than 403, so ids do not leak.
    if (!row || (!actor.isSuperAdmin && row.schoolId !== actor.schoolId)) {
      throw new NotFoundException('Medium not found');
    }

    return row;
  }

  private toResponse(row: MediumRow): MediumResponseDto {
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      schoolId: row.schoolId,
      sectionCount: row._count.sections,
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
          resource: 'medium',
          resourceId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }
}
