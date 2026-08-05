import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GuardianRelationship, UserStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const blankToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

/** The guardian record — what is true of someone *because* they are a guardian. */
export class ParentProfileFieldsDto {
  @ApiPropertyOptional({ example: 'Civil engineer', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(100)
  occupation?: string | null;

  @ApiPropertyOptional({
    example: 'Ramesh Nair',
    nullable: true,
    description: 'Who to call when this guardian cannot be reached.',
  })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(120)
  emergencyContactName?: string | null;

  @ApiPropertyOptional({ example: '+91 98765 43210', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(30)
  emergencyContactPhone?: string | null;

  @ApiPropertyOptional({ example: 'Uncle', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(60)
  emergencyContactRelation?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(1000)
  notes?: string | null;
}

/** Contact details and address, which live on the user row. */
export class ParentContactDto {
  @ApiPropertyOptional({ example: 'Priya' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Menon' })
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
}

/**
 * Creating a guardian.
 *
 * Either promotes an existing account (`userId`) or creates one. Unlike
 * teachers, guardians are not identifiable by any capability — the Parent role
 * grants nothing — so being a guardian is recorded explicitly rather than
 * inferred, and this is how the record comes into being.
 */
export class CreateParentDto extends ParentProfileFieldsDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Promote an existing user.' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ example: 'priya.menon@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(255)
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @ApiPropertyOptional({ example: 'Priya' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Menon' })
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
    description: 'Initial password for the new account. Required when `userId` is absent.',
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
    description: "Roles for the new account — normally the school's Parent role.",
  })
  @IsOptional()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

export class UpdateParentDto extends ParentProfileFieldsDto {
  @ApiPropertyOptional({ type: ParentContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ParentContactDto)
  contact?: ParentContactDto;
}

// ---------------------------------------------------------------------------

class LinkedStudentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'ADM-2026-014' }) admissionNo!: string;
  @ApiProperty({ example: 'Aarav' }) firstName!: string;
  @ApiProperty({ example: 'Menon' }) lastName!: string;
  @ApiPropertyOptional({ example: 'Class 9', nullable: true }) className!: string | null;
  @ApiPropertyOptional({ example: 'A', nullable: true }) sectionName!: string | null;
  @ApiProperty({ enum: GuardianRelationship }) relationship!: GuardianRelationship;
  @ApiProperty() isPrimaryContact!: boolean;
}

export class ParentResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Id of the guardian user.' }) id!: string;
  @ApiProperty({ format: 'uuid', description: 'Same value as `id`.' }) userId!: string;

  @ApiProperty({ example: 'Priya' }) firstName!: string;
  @ApiProperty({ example: 'Menon' }) lastName!: string;
  @ApiProperty({ example: 'priya.menon@example.com' }) email!: string;
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;

  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) avatarUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) addressLine1!: string | null;
  @ApiPropertyOptional({ nullable: true }) addressLine2!: string | null;
  @ApiPropertyOptional({ nullable: true }) city!: string | null;
  @ApiPropertyOptional({ nullable: true }) state!: string | null;
  @ApiPropertyOptional({ nullable: true }) postalCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) country!: string | null;

  @ApiPropertyOptional({ nullable: true }) occupation!: string | null;
  @ApiPropertyOptional({ nullable: true }) emergencyContactName!: string | null;
  @ApiPropertyOptional({ nullable: true }) emergencyContactPhone!: string | null;
  @ApiPropertyOptional({ nullable: true }) emergencyContactRelation!: string | null;
  @ApiPropertyOptional({ nullable: true }) notes!: string | null;

  @ApiProperty({ example: ['Parent'], isArray: true, type: String }) roles!: string[];

  @ApiProperty({ type: LinkedStudentDto, isArray: true })
  students!: LinkedStudentDto[];

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

export class LinkStudentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  studentId!: string;

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

export class UpdateLinkDto {
  @ApiPropertyOptional({ enum: GuardianRelationship })
  @IsOptional()
  @IsEnum(GuardianRelationship)
  relationship?: GuardianRelationship;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;
}
