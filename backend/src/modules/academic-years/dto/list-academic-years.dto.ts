import { ApiPropertyOptional } from '@nestjs/swagger';
import { AcademicYearStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto';

/** Whitelisted because `sortBy` reaches Prisma's `orderBy` directly. */
export const ACADEMIC_YEAR_SORT_FIELDS = [
  'startDate',
  'endDate',
  'name',
  'status',
  'createdAt',
] as const;

export type AcademicYearSortField = (typeof ACADEMIC_YEAR_SORT_FIELDS)[number];

export class ListAcademicYearsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ACADEMIC_YEAR_SORT_FIELDS, default: 'startDate' })
  @IsOptional()
  @IsIn(ACADEMIC_YEAR_SORT_FIELDS, {
    message: `sortBy must be one of: ${ACADEMIC_YEAR_SORT_FIELDS.join(', ')}`,
  })
  override sortBy?: AcademicYearSortField = 'startDate';

  @ApiPropertyOptional({ enum: AcademicYearStatus })
  @IsOptional()
  @IsEnum(AcademicYearStatus)
  status?: AcademicYearStatus;

  @ApiPropertyOptional({ format: 'uuid', description: "Defaults to the caller's own school." })
  @IsOptional()
  @IsUUID('4')
  schoolId?: string;
}
