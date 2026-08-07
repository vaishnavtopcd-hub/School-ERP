import { ApiPropertyOptional } from '@nestjs/swagger';
import { StudentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto';

/** Whitelisted because `sortBy` maps to Prisma's `orderBy` directly. */
export const STUDENT_SORT_FIELDS = ['admissionNo', 'firstName', 'lastName', 'createdAt'] as const;
export type StudentSortField = (typeof STUDENT_SORT_FIELDS)[number];

export class ListStudentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STUDENT_SORT_FIELDS, default: 'admissionNo' })
  @IsOptional()
  @IsIn(STUDENT_SORT_FIELDS, {
    message: `sortBy must be one of: ${STUDENT_SORT_FIELDS.join(', ')}`,
  })
  override sortBy?: StudentSortField = 'admissionNo';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @ApiPropertyOptional({ description: 'Only students with no guardian linked.' })
  @IsOptional()
  @Transform(({ value }): unknown => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  unlinked?: boolean;
}
