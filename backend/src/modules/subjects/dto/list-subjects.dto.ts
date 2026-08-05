import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto';

/** Whitelisted because `sortBy` reaches Prisma's `orderBy` directly. */
export const SUBJECT_SORT_FIELDS = ['code', 'name', 'credits', 'createdAt'] as const;
export type SubjectSortField = (typeof SUBJECT_SORT_FIELDS)[number];

export class ListSubjectsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SUBJECT_SORT_FIELDS, default: 'code' })
  @IsOptional()
  @IsIn(SUBJECT_SORT_FIELDS, {
    message: `sortBy must be one of: ${SUBJECT_SORT_FIELDS.join(', ')}`,
  })
  override sortBy?: SubjectSortField = 'code';

  @ApiPropertyOptional({ format: 'uuid', description: 'Only subjects taught to this class.' })
  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only subjects taught by this teacher.' })
  @IsOptional()
  @IsUUID('4')
  teacherId?: string;

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
