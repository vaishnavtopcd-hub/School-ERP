import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto';

/** Whitelisted because `sortBy` maps to Prisma's `orderBy` directly. */
export const TEACHER_SORT_FIELDS = [
  'firstName',
  'employeeCode',
  'experienceYears',
  'joinedOn',
  'createdAt',
] as const;
export type TeacherSortField = (typeof TEACHER_SORT_FIELDS)[number];

export class ListTeachersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TEACHER_SORT_FIELDS, default: 'firstName' })
  @IsOptional()
  @IsIn(TEACHER_SORT_FIELDS, {
    message: `sortBy must be one of: ${TEACHER_SORT_FIELDS.join(', ')}`,
  })
  override sortBy?: TeacherSortField = 'firstName';

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Only users holding exactly this role. Omitted, the list is everyone whose role grants ' +
      'class access — which is what makes teaching staff appear without an employment record.',
  })
  @IsOptional()
  @IsUUID('4')
  roleId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only teachers allocated to a subject in this class, or class teacher of one.',
  })
  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @ApiPropertyOptional({ description: 'Only teachers with no subject allocated.' })
  @IsOptional()
  @Transform(({ value }): unknown => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  unallocated?: boolean;
}
