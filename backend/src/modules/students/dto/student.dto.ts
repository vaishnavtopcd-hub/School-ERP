import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BloodGroup, Gender, GuardianRelationship, StudentStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AVATAR_DATA_URL, MAX_AVATAR_DATA_URL_LENGTH } from '@/modules/auth/dto';

/** Letters, digits, hyphen, slash — how admission numbers are actually written. */
const ADMISSION_NO = /^[A-Z0-9\-/]+$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const upperTrim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/**
 * Blank text fields arrive from the form as `''`; storing that would make
 * "cleared" and "never filled in" two different states for no reason.
 */
const blankToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

/** A guardian to attach at enrolment. Mirrors `LinkStudentDto` from the other side. */
export class StudentGuardianInputDto {
  @ApiProperty({ format: 'uuid', description: 'Id of the guardian **user**.' })
  @IsUUID('4')
  parentId!: string;

  @ApiProperty({ enum: GuardianRelationship })
  @IsEnum(GuardianRelationship)
  relationship!: GuardianRelationship;

  @ApiPropertyOptional({
    default: false,
    description: 'The guardian the school calls first. At most one per student.',
  })
  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean = false;
}

export class CreateStudentDto {
  @ApiPropertyOptional({
    example: 'ADM-2026-0014',
    description:
      'Upper-cased, unique within the school. **Omit it and one is generated** — ' +
      'ADM-<year>-<sequence>, continuing the school’s highest number for that year.',
  })
  @IsOptional()
  @IsString()
  @Transform(upperTrim)
  @MinLength(2)
  @MaxLength(30)
  @Matches(ADMISSION_NO, {
    message: 'Admission number may contain only letters, numbers, hyphens, and slashes.',
  })
  admissionNo?: string;

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

  @ApiPropertyOptional({ enum: Gender, nullable: true })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @ApiPropertyOptional({
    description: 'Square photo as a base64 data URL (png, jpeg, or webp). Send null to remove it.',
    example: 'data:image/webp;base64,UklGRi4AAABXRUJQ...',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AVATAR_DATA_URL_LENGTH, {
    message: 'Image is too large. Choose a smaller picture.',
  })
  @Matches(AVATAR_DATA_URL, { message: 'Photo must be a png, jpeg, or webp data URL.' })
  photoUrl?: string | null;

  @ApiPropertyOptional({ enum: BloodGroup, nullable: true })
  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup | null;

  @ApiPropertyOptional({
    example: 'Peanut allergy — EpiPen in the school office. Asthma inhaler as needed.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(2000)
  medicalNotes?: string | null;

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

  @ApiPropertyOptional({
    type: StudentGuardianInputDto,
    isArray: true,
    description:
      'Guardians to link as part of enrolling. On PATCH this **replaces** the whole set: ' +
      'guardians left out are unlinked. Omit the field entirely to leave the links alone.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => StudentGuardianInputDto)
  guardians?: StudentGuardianInputDto[];
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
  @ApiProperty({ example: 'ADM-2026-0014' }) admissionNo!: string;
  @ApiProperty({ example: 'Aarav' }) firstName!: string;
  @ApiProperty({ example: 'Menon' }) lastName!: string;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  dateOfBirth!: string | null;
  @ApiPropertyOptional({ enum: Gender, nullable: true }) gender!: Gender | null;
  @ApiPropertyOptional({ nullable: true, description: 'Data URL.' }) photoUrl!: string | null;
  @ApiPropertyOptional({ enum: BloodGroup, nullable: true }) bloodGroup!: BloodGroup | null;
  @ApiPropertyOptional({ nullable: true }) medicalNotes!: string | null;
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

export class NextAdmissionNoDto {
  @ApiProperty({
    example: 'ADM-2026-0015',
    description:
      'What enrolling right now would be given. Advisory: another enrolment in the meantime ' +
      'takes it, and the next caller gets the one after.',
  })
  admissionNo!: string;
}
