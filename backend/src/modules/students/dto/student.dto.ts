import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { StudentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Letters, digits, hyphen, slash — how admission numbers are actually written. */
const ADMISSION_NO = /^[A-Z0-9\-/]+$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const upperTrim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateStudentDto {
  @ApiProperty({ example: 'ADM-2026-014', description: 'Upper-cased. Unique within the school.' })
  @IsString()
  @Transform(upperTrim)
  @MinLength(2)
  @MaxLength(30)
  @Matches(ADMISSION_NO, {
    message: 'Admission number may contain only letters, numbers, hyphens, and slashes.',
  })
  admissionNo!: string;

  @ApiProperty({ example: 'Aarav' })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Menon' })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @ApiPropertyOptional({ format: 'date', example: '2014-03-22', nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'dateOfBirth must be a date, e.g. 2014-03-22' })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Optional — a student can be enrolled before being placed in a class.',
  })
  @IsOptional()
  @IsUUID('4')
  classId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Must belong to the chosen class.',
  })
  @IsOptional()
  @IsUUID('4')
  sectionId?: string | null;

  @ApiPropertyOptional({ enum: StudentStatus, default: StudentStatus.ACTIVE })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus = StudentStatus.ACTIVE;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}

// ---------------------------------------------------------------------------

class StudentGuardianDto {
  @ApiProperty({ format: 'uuid', description: 'Id of the guardian user.' }) id!: string;
  @ApiProperty({ example: 'Priya' }) firstName!: string;
  @ApiProperty({ example: 'Menon' }) lastName!: string;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiProperty({ example: 'MOTHER' }) relationship!: string;
  @ApiProperty() isPrimaryContact!: boolean;
}

export class StudentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'ADM-2026-014' }) admissionNo!: string;
  @ApiProperty({ example: 'Aarav' }) firstName!: string;
  @ApiProperty({ example: 'Menon' }) lastName!: string;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  dateOfBirth!: string | null;
  @ApiProperty({ enum: StudentStatus }) status!: StudentStatus;
  @ApiProperty({ format: 'uuid' }) schoolId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) classId!: string | null;
  @ApiPropertyOptional({ example: 'Class 9', nullable: true }) className!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) sectionId!: string | null;
  @ApiPropertyOptional({ example: 'A', nullable: true }) sectionName!: string | null;

  @ApiProperty({ type: StudentGuardianDto, isArray: true })
  guardians!: StudentGuardianDto[];

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
