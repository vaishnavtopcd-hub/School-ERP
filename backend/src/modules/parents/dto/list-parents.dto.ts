import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto';

/** Whitelisted because `sortBy` maps to Prisma's `orderBy` directly. */
export const PARENT_SORT_FIELDS = ['firstName', 'lastName', 'createdAt'] as const;
export type ParentSortField = (typeof PARENT_SORT_FIELDS)[number];

export class ListParentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PARENT_SORT_FIELDS, default: 'firstName' })
  @IsOptional()
  @IsIn(PARENT_SORT_FIELDS, {
    message: `sortBy must be one of: ${PARENT_SORT_FIELDS.join(', ')}`,
  })
  override sortBy?: ParentSortField = 'firstName';

  @ApiPropertyOptional({ format: 'uuid', description: 'Guardians of students in this class.' })
  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Guardians of this specific student.' })
  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @ApiPropertyOptional({ description: 'Only guardians with no student linked yet.' })
  @IsOptional()
  @Transform(({ value }): unknown => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  unlinked?: boolean;
}
