import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** `YYYY-MM`, the granularity every report in this module works at. */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const blankToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

export class MarkStudentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  studentId!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional({ example: 'Dentist appointment', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(200)
  remarks?: string | null;
}

export class MarkAttendanceDto {
  @ApiProperty({ format: 'uuid', description: 'The section whose register this is.' })
  @IsUUID('4')
  sectionId!: string;

  @ApiProperty({ format: 'date', example: '2026-08-07', description: 'Cannot be in the future.' })
  @IsDateString({}, { message: 'date must be a date, e.g. 2026-08-07' })
  date!: string;

  @ApiProperty({
    type: MarkStudentDto,
    isArray: true,
    description:
      'Every student being marked. Sending a student again for the same day corrects the ' +
      'existing mark rather than adding a second one.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MarkStudentDto)
  records!: MarkStudentDto[];
}

export class OverviewQueryDto {
  @ApiPropertyOptional({
    format: 'date',
    example: '2026-08-07',
    description: 'Which day to report progress against. Defaults to today.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'date must be a date, e.g. 2026-08-07' })
  date?: string;
}

/** One section on the overview: how big it is, and whether today is done. */
export class SectionOverviewRowDto {
  @ApiProperty({ format: 'uuid' }) sectionId!: string;
  @ApiProperty({ format: 'uuid' }) classId!: string;
  @ApiProperty({ example: 'Class 9' }) className!: string;
  @ApiProperty({ example: 'A' }) sectionName!: string;

  @ApiProperty({
    description:
      'False for a retired section. Those are listed only while students remain in them — a ' +
      'child nobody can mark is worse than a stale row.',
  })
  isActive!: boolean;

  @ApiProperty({ example: 32, description: 'Enrolled and active.' }) students!: number;
  @ApiProperty({ example: 32, description: 'How many carry a mark for this date.' })
  marked!: number;

  @ApiProperty({ description: 'Every student marked. False for an empty section.' })
  isComplete!: boolean;

  @ApiProperty({ example: 2, description: 'Absent, on leave, or late — the exceptions.' })
  away!: number;
}

export class AttendanceOverviewDto {
  @ApiProperty({ type: String, format: 'date', example: '2026-08-07' }) date!: string;

  @ApiProperty({
    type: SectionOverviewRowDto,
    isArray: true,
    description: 'Every section in the school, ordered by class then section.',
  })
  sections!: SectionOverviewRowDto[];
}

export class DailyRegisterQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  sectionId!: string;

  @ApiProperty({ format: 'date', example: '2026-08-07' })
  @IsDateString({}, { message: 'date must be a date, e.g. 2026-08-07' })
  date!: string;
}

export class ClearedDayDto {
  @ApiProperty({ example: 32, description: 'Marks removed. Zero when the day was never taken.' })
  cleared!: number;
}

export class MonthlyReportQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  sectionId!: string;

  @ApiProperty({ example: '2026-08', description: 'YYYY-MM.' })
  @IsString()
  @Matches(MONTH, { message: 'month must be YYYY-MM, e.g. 2026-08' })
  month!: string;
}

export class StudentHistoryQueryDto {
  @ApiPropertyOptional({
    example: '2026-08',
    description: 'YYYY-MM. Defaults to the current month.',
  })
  @IsOptional()
  @IsString()
  @Matches(MONTH, { message: 'month must be YYYY-MM, e.g. 2026-08' })
  month?: string;
}

// ---------------------------------------------------------------------------

/** One row of the register: a student, and how they were marked — if they were. */
export class RegisterRowDto {
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ example: 'ADM-2026-0014' }) admissionNo!: string;
  @ApiProperty({ example: 'Aarav' }) firstName!: string;
  @ApiProperty({ example: 'Menon' }) lastName!: string;
  @ApiPropertyOptional({ nullable: true }) photoUrl!: string | null;

  @ApiPropertyOptional({
    enum: AttendanceStatus,
    nullable: true,
    description: 'Null means this student has not been marked for this date.',
  })
  status!: AttendanceStatus | null;

  @ApiPropertyOptional({ nullable: true }) remarks!: string | null;
}

export class DailyRegisterDto {
  @ApiProperty({ type: String, format: 'date', example: '2026-08-07' }) date!: string;
  @ApiProperty({ format: 'uuid' }) sectionId!: string;
  @ApiProperty({ example: 'Class 9' }) className!: string;
  @ApiProperty({ example: 'A' }) sectionName!: string;

  @ApiProperty({
    description: 'True once every student on the roster carries a mark for this date.',
  })
  isComplete!: boolean;

  @ApiProperty({ type: RegisterRowDto, isArray: true, description: 'Ordered by admission number.' })
  students!: RegisterRowDto[];
}

export class AttendanceCountsDto {
  @ApiProperty({ example: 18 }) present!: number;
  @ApiProperty({ example: 1 }) absent!: number;
  @ApiProperty({ example: 1 }) leave!: number;
  @ApiProperty({ example: 2 }) late!: number;
  @ApiProperty({ example: 22, description: 'Days marked. Unmarked days are not counted.' })
  marked!: number;

  @ApiProperty({
    example: 90.9,
    description:
      'Present and late as a percentage of days marked — late is still in attendance. Null when ' +
      'nothing has been marked.',
    nullable: true,
  })
  percentage!: number | null;
}

export class MonthlyStudentRowDto {
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ example: 'ADM-2026-0014' }) admissionNo!: string;
  @ApiProperty({ example: 'Aarav' }) firstName!: string;
  @ApiProperty({ example: 'Menon' }) lastName!: string;

  @ApiProperty({ type: AttendanceCountsDto }) counts!: AttendanceCountsDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: { enum: Object.values(AttendanceStatus) },
    description: 'Keyed by `YYYY-MM-DD`. Absent keys are days that were never marked.',
    example: { '2026-08-03': 'PRESENT', '2026-08-04': 'ABSENT' },
  })
  byDate!: Record<string, AttendanceStatus>;
}

export class MonthlyReportDto {
  @ApiProperty({ example: '2026-08' }) month!: string;
  @ApiProperty({ format: 'uuid' }) sectionId!: string;
  @ApiProperty({ example: 'Class 9' }) className!: string;
  @ApiProperty({ example: 'A' }) sectionName!: string;

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'Every date in the month that has at least one mark, ascending.',
  })
  dates!: string[];

  @ApiProperty({ type: MonthlyStudentRowDto, isArray: true })
  students!: MonthlyStudentRowDto[];
}

export class AttendanceDayDto {
  @ApiProperty({ type: String, format: 'date', example: '2026-08-07' }) date!: string;
  @ApiProperty({ enum: AttendanceStatus }) status!: AttendanceStatus;
  @ApiPropertyOptional({ nullable: true }) remarks!: string | null;
}

/** One student's month — the shape both the profile tab and a parent read. */
export class StudentAttendanceDto {
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ example: 'Aarav' }) firstName!: string;
  @ApiProperty({ example: 'Menon' }) lastName!: string;
  @ApiProperty({ example: 'ADM-2026-0014' }) admissionNo!: string;
  @ApiPropertyOptional({ example: 'Class 9', nullable: true }) className!: string | null;
  @ApiPropertyOptional({ example: 'A', nullable: true }) sectionName!: string | null;

  @ApiProperty({ example: '2026-08' }) month!: string;
  @ApiProperty({ type: AttendanceCountsDto }) counts!: AttendanceCountsDto;

  @ApiProperty({ type: AttendanceDayDto, isArray: true, description: 'Ascending by date.' })
  days!: AttendanceDayDto[];
}
