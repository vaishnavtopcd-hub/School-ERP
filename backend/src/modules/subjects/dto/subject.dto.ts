import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
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

/**
 * Upper bound on credits. Not a domain truth so much as a guard against a typo
 * turning 4 into 400 — schools that weight subjects use single digits.
 */
export const MAX_SUBJECT_CREDITS = 20;

/** Letters, digits, hyphen. Rules out whitespace and punctuation in a code. */
const SUBJECT_CODE = /^[A-Z0-9-]+$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Codes are case-insensitive in practice, so they are stored one way. */
const upperTrim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateSubjectDto {
  @ApiProperty({
    example: 'MATH101',
    description: 'Upper-cased on save. Unique within the class.',
  })
  @IsString()
  @Transform(upperTrim)
  @MinLength(2)
  @MaxLength(20)
  @Matches(SUBJECT_CODE, {
    message: 'Subject code may contain only letters, numbers, and hyphens.',
  })
  code!: string;

  @ApiProperty({ example: 'Mathematics', description: 'Unique within the class.' })
  @IsString()
  @Transform(trim)
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ format: 'uuid', description: 'The class this subject is taught to.' })
  @IsUUID('4')
  classId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Teacher responsible. Send null to leave it unassigned.',
  })
  @IsOptional()
  @IsUUID('4')
  teacherId?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_SUBJECT_CREDITS, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SUBJECT_CREDITS)
  credits?: number = 0;

  @ApiPropertyOptional({
    default: true,
    description: 'Inactive subjects are retained for records but not taught.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}

// ---------------------------------------------------------------------------

class SubjectClassDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Class 9' }) name!: string;
}

class SubjectTeacherDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Asha' }) firstName!: string;
  @ApiProperty({ example: 'Rao' }) lastName!: string;
  @ApiProperty({ example: 'asha@school-erp.local' }) email!: string;
}

export class SubjectResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'MATH101' }) code!: string;
  @ApiProperty({ example: 'Mathematics' }) name!: string;
  @ApiProperty({ example: 4 }) credits!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ format: 'uuid' }) schoolId!: string;

  @ApiProperty({ type: SubjectClassDto }) class!: SubjectClassDto;

  @ApiPropertyOptional({ type: SubjectTeacherDto, nullable: true })
  teacher!: SubjectTeacherDto | null;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
