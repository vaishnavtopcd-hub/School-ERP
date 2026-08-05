import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AVATAR_DATA_URL, MAX_AVATAR_DATA_URL_LENGTH } from '@/modules/auth/dto';

/** Nobody has taught for a century; this catches a year typed into a years box. */
export const MAX_EXPERIENCE_YEARS = 60;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const blankToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

/** The employment record itself — everything true of someone *because* they teach here. */
export class TeacherProfileFieldsDto {
  @ApiPropertyOptional({ example: 'EMP-104', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(40)
  employeeCode?: string | null;

  @ApiPropertyOptional({ example: 'M.Sc Mathematics, B.Ed', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(200)
  qualification?: string | null;

  @ApiPropertyOptional({ example: 'Mathematics', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(100)
  specialisation?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_EXPERIENCE_YEARS, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_EXPERIENCE_YEARS)
  experienceYears?: number = 0;

  @ApiPropertyOptional({ format: 'date', example: '2021-06-01', nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'joinedOn must be a date, e.g. 2021-06-01' })
  joinedOn?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(1000)
  bio?: string | null;
}

/**
 * Contact details and photo live on the user row, not the profile — this is the
 * subset an administrator may edit on someone else's behalf.
 */
export class TeacherContactDto {
  @ApiPropertyOptional({ example: 'Asha' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rao' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(200)
  addressLine1?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(200)
  addressLine2?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(100)
  state?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(20)
  postalCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(100)
  country?: string | null;

  @ApiPropertyOptional({
    description: 'Square photo as a base64 data URL. Send null to remove it.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AVATAR_DATA_URL_LENGTH, {
    message: 'Image is too large. Choose a smaller picture.',
  })
  @Matches(AVATAR_DATA_URL, { message: 'Photo must be a png, jpeg, or webp data URL.' })
  avatarUrl?: string | null;
}

/**
 * Creating a teacher.
 *
 * Two shapes, because both are real: promoting someone who already has an
 * account (`userId`), or taking on a new member of staff, which needs an
 * account made for them. The second path delegates to UsersService rather than
 * reimplementing password hashing, role grantability, and email uniqueness.
 */
export class CreateTeacherDto extends TeacherProfileFieldsDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Promote an existing user. When given, the account fields below are ignored — edit them ' +
      'through /users or by updating the teacher afterwards.',
  })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({
    example: 'asha.rao@school-erp.local',
    description: 'Required when `userId` is absent — a new account is created.',
  })
  @IsOptional()
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(255)
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @ApiPropertyOptional({ example: 'Asha' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rao' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210' })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({
    minLength: 12,
    description:
      'Initial password for the new account. Required when `userId` is absent. Convey it out ' +
      'of band — the teacher should change it on first sign-in.',
  })
  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({
    isArray: true,
    type: String,
    format: 'uuid',
    description:
      'Roles for the new account. A teaching role is what makes them eligible for class and ' +
      'subject allocation, so this is normally the school’s Teacher role.',
  })
  @IsOptional()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

/** Editing a teacher: the employment record, plus their contact details. */
export class UpdateTeacherDto extends TeacherProfileFieldsDto {
  @ApiPropertyOptional({ type: TeacherContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TeacherContactDto)
  contact?: TeacherContactDto;
}

// ---------------------------------------------------------------------------

class AllocatedSubjectDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'MATH101' }) code!: string;
  @ApiProperty({ example: 'Mathematics' }) name!: string;
  @ApiProperty({ example: 4 }) credits!: number;
  @ApiProperty({ example: 'Class 9' }) className!: string;
  @ApiProperty({ format: 'uuid' }) classId!: string;
}

class AllocatedSectionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'A' }) name!: string;
  @ApiProperty({ example: 'Class 9' }) className!: string;
  @ApiProperty({ format: 'uuid' }) classId!: string;
}

export class TeacherResponseDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Id of the **user**. The employment record is optional, so it cannot be the identity — ' +
      'every /teachers/:id route takes this.',
  })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Same value as `id`, named explicitly.' })
  userId!: string;

  @ApiProperty({
    description:
      'False for someone listed purely on their role. Their employment fields read as empty ' +
      'until the first save, which creates the record.',
  })
  hasProfile!: boolean;

  @ApiProperty({ example: 'Asha' }) firstName!: string;
  @ApiProperty({ example: 'Rao' }) lastName!: string;
  @ApiProperty({ example: 'asha.rao@school-erp.local' }) email!: string;
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;

  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) avatarUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) addressLine1!: string | null;
  @ApiPropertyOptional({ nullable: true }) addressLine2!: string | null;
  @ApiPropertyOptional({ nullable: true }) city!: string | null;
  @ApiPropertyOptional({ nullable: true }) state!: string | null;
  @ApiPropertyOptional({ nullable: true }) postalCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) country!: string | null;

  @ApiPropertyOptional({ nullable: true }) employeeCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) qualification!: string | null;
  @ApiPropertyOptional({ nullable: true }) specialisation!: string | null;
  @ApiProperty({ example: 8 }) experienceYears!: number;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  joinedOn!: string | null;
  @ApiPropertyOptional({ nullable: true }) bio!: string | null;

  @ApiProperty({
    example: ['Teacher'],
    isArray: true,
    type: String,
    description: 'Display names of the roles held — this is why the user is listed.',
  })
  roles!: string[];

  @ApiProperty({ isArray: true, type: String, format: 'uuid' })
  roleIds!: string[];

  @ApiProperty({ type: AllocatedSubjectDto, isArray: true })
  subjects!: AllocatedSubjectDto[];

  @ApiProperty({ type: AllocatedSectionDto, isArray: true })
  sections!: AllocatedSectionDto[];

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

export class AllocateSubjectDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  subjectId!: string;
}

export class AllocateSectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  sectionId!: string;
}
