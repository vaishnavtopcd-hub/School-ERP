import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PeriodResponseDto } from './period.dto';

export class CreateTimetableEntryDto {
  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  day!: DayOfWeek;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  periodId!: string;

  @ApiProperty({ format: 'uuid', description: 'The section being taught.' })
  @IsUUID('4')
  sectionId!: string;

  @ApiProperty({ format: 'uuid', description: "Must belong to the section's class." })
  @IsUUID('4')
  subjectId!: string;

  @ApiProperty({ format: 'uuid', description: 'Id of the teacher **user**.' })
  @IsUUID('4')
  teacherId!: string;
}

export class UpdateTimetableEntryDto extends PartialType(CreateTimetableEntryDto) {}

/** Either a section's week or a teacher's week — exactly one is required. */
export class WeeklyTimetableQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Id of the teacher user.' })
  @IsOptional()
  @IsUUID('4')
  teacherId?: string;
}

export class TimetableEntryResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: DayOfWeek }) day!: DayOfWeek;

  @ApiProperty({ format: 'uuid' }) periodId!: string;
  @ApiProperty({ example: 'Period 1' }) periodName!: string;

  @ApiProperty({ format: 'uuid' }) sectionId!: string;
  @ApiProperty({ example: 'A' }) sectionName!: string;
  @ApiProperty({ format: 'uuid' }) classId!: string;
  @ApiProperty({ example: 'Class 9' }) className!: string;

  @ApiProperty({ format: 'uuid' }) subjectId!: string;
  @ApiProperty({ example: 'Mathematics' }) subjectName!: string;
  @ApiProperty({ example: 'MATH101' }) subjectCode!: string;

  @ApiProperty({ format: 'uuid' }) teacherId!: string;
  @ApiProperty({ example: 'Asha Rao' }) teacherName!: string;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

/**
 * A whole week in one response.
 *
 * The period ladder travels with the entries because the grid cannot be drawn
 * without it — including the breaks, which hold no lessons but still occupy a
 * row. Fetching them separately would mean rendering a grid whose rows arrive
 * after its contents.
 */
export class WeeklyTimetableDto {
  @ApiProperty({ type: PeriodResponseDto, isArray: true, description: 'Ordered by sequence.' })
  periods!: PeriodResponseDto[];

  @ApiProperty({ enum: DayOfWeek, isArray: true, description: 'Days that hold at least one slot.' })
  days!: DayOfWeek[];

  @ApiProperty({ type: TimetableEntryResponseDto, isArray: true })
  entries!: TimetableEntryResponseDto[];
}
