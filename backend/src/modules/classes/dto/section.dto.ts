import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Generous but bounded — an unbounded capacity is always a data-entry slip. */
export const MAX_SECTION_CAPACITY = 300;

export class CreateSectionDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiProperty({ example: 40, minimum: 1, maximum: MAX_SECTION_CAPACITY })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Capacity must be at least 1' })
  @Max(MAX_SECTION_CAPACITY, { message: `Capacity cannot exceed ${MAX_SECTION_CAPACITY}` })
  capacity!: number;

  @ApiPropertyOptional({
    example: 'Science',
    description:
      'Stream qualifier. Section "A" may exist once per division, so Science and Commerce can ' +
      'coexist within one class. Omit for schools that do not stream.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  // Normalised to '' so it can take part in the uniqueness constraint.
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : ''))
  division?: string = '';

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: "Language of instruction. Must be one of the school's mediums.",
  })
  @IsOptional()
  @IsUUID('4')
  mediumId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'A user holding a role that can access classes, at the same school.',
  })
  @IsOptional()
  @IsUUID('4')
  classTeacherId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateSectionDto {
  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ example: 40, minimum: 1, maximum: MAX_SECTION_CAPACITY })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Capacity must be at least 1' })
  @Max(MAX_SECTION_CAPACITY, { message: `Capacity cannot exceed ${MAX_SECTION_CAPACITY}` })
  capacity?: number;

  @ApiPropertyOptional({ example: 'Science' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : ''))
  division?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Send null to clear the medium.',
  })
  @IsOptional()
  @IsUUID('4')
  mediumId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Send null to unassign the current class teacher.',
  })
  @IsOptional()
  // Explicitly nullable: `undefined` leaves the teacher alone, `null` clears it.
  @IsUUID('4')
  classTeacherId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
