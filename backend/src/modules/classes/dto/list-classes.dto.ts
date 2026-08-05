import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto';

/** Whitelisted because `sortBy` reaches Prisma's `orderBy` directly. */
export const CLASS_SORT_FIELDS = ['level', 'name', 'createdAt'] as const;
export type ClassSortField = (typeof CLASS_SORT_FIELDS)[number];

export class ListClassesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CLASS_SORT_FIELDS, default: 'level' })
  @IsOptional()
  @IsIn(CLASS_SORT_FIELDS, { message: `sortBy must be one of: ${CLASS_SORT_FIELDS.join(', ')}` })
  override sortBy?: ClassSortField = 'level';

  @ApiPropertyOptional({
    format: 'uuid',
    description: "Defaults to the school's currently active academic year.",
  })
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }): unknown => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
