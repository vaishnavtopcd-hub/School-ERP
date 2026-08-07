import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ExamStatus, ExamType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '@/common/dto';

/** 24-hour `HH:mm`, the same shape a period uses. */
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const blankToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

export class CreateExamDto {
  @ApiProperty({ example: 'Midterm 2026' })
  @IsString()
  @Transform(trim)
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: ExamType })
  @IsEnum(ExamType)
  type!: ExamType;

  @ApiProperty({
    format: 'uuid',
    description: 'The class sitting it. Every section sits the same papers.',
  })
  @IsUUID('4')
  classId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: "Defaults to the school's active academic year.",
  })
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string | null;

  @ApiPropertyOptional({ example: 'Bring your own instruments.', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(2000)
  instructions?: string | null;
}

/** Status is absent on purpose — publishing and archiving have their own routes. */
export class UpdateExamDto extends PartialType(CreateExamDto) {}

export class ListExamsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ExamStatus })
  @IsOptional()
  @IsEnum(ExamStatus)
  status?: ExamStatus;

  @ApiPropertyOptional({ enum: ExamType })
  @IsOptional()
  @IsEnum(ExamType)
  type?: ExamType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  classId?: string;
}

export class CreateExamPaperDto {
  @ApiProperty({ format: 'uuid', description: "Must belong to the exam's class." })
  @IsUUID('4')
  subjectId!: string;

  @ApiProperty({ format: 'date', example: '2026-09-14' })
  @IsDateString({}, { message: 'date must be a date, e.g. 2026-09-14' })
  date!: string;

  @ApiProperty({ example: '09:30', description: '24-hour HH:mm.' })
  @IsString()
  @Transform(trim)
  @Matches(CLOCK_TIME, { message: 'startTime must be a 24-hour time, e.g. 09:30' })
  startTime!: string;

  @ApiProperty({ example: '12:30', description: '24-hour HH:mm. Must be after startTime.' })
  @IsString()
  @Transform(trim)
  @Matches(CLOCK_TIME, { message: 'endTime must be a 24-hour time, e.g. 12:30' })
  endTime!: string;

  @ApiProperty({ example: 100, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxMarks!: number;

  @ApiProperty({ example: 35, minimum: 0, description: 'Cannot exceed maxMarks.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  passMarks!: number;

  @ApiPropertyOptional({ example: 'Hall B', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(80)
  venue?: string | null;
}

export class UpdateExamPaperDto extends PartialType(CreateExamPaperDto) {}

// ---------------------------------------------------------------------------

export class ExamPaperResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) subjectId!: string;
  @ApiProperty({ example: 'Mathematics' }) subjectName!: string;
  @ApiProperty({ example: 'MATH101' }) subjectCode!: string;
  @ApiProperty({ type: String, format: 'date', example: '2026-09-14' }) date!: string;
  @ApiProperty({ example: '09:30' }) startTime!: string;
  @ApiProperty({ example: '12:30' }) endTime!: string;
  @ApiProperty({ example: 100 }) maxMarks!: number;
  @ApiProperty({ example: 35 }) passMarks!: number;
  @ApiPropertyOptional({ nullable: true }) venue!: string | null;
}

export class ExamResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Midterm 2026' }) name!: string;
  @ApiProperty({ enum: ExamType }) type!: ExamType;
  @ApiProperty({ enum: ExamStatus }) status!: ExamStatus;

  @ApiProperty({ format: 'uuid' }) classId!: string;
  @ApiProperty({ example: 'Class 9' }) className!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) academicYearId!: string | null;
  @ApiPropertyOptional({ example: '2026-2027', nullable: true }) academicYearName!: string | null;

  @ApiPropertyOptional({ nullable: true }) instructions!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ example: 6, description: 'How many papers are scheduled.' })
  paperCount!: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description: 'First and last paper. Null while nothing is scheduled.',
  })
  startsOn!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  endsOn!: string | null;

  @ApiProperty({
    type: ExamPaperResponseDto,
    isArray: true,
    description: 'Ordered by date, then start time.',
  })
  papers!: ExamPaperResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
