import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Date-only, no timezone. A full ISO timestamp would make "when does the year
 * start" depend on the caller's offset, which is exactly the ambiguity an
 * academic calendar must not have.
 */
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ONLY_MESSAGE = 'Use a date in YYYY-MM-DD form';

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2025-2026' })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiProperty({ example: '2025-06-01', description: 'First day of the session (inclusive)' })
  @Matches(DATE_ONLY_PATTERN, { message: `startDate: ${DATE_ONLY_MESSAGE}` })
  startDate!: string;

  @ApiProperty({ example: '2026-03-31', description: 'Last day of the session (inclusive)' })
  @Matches(DATE_ONLY_PATTERN, { message: `endDate: ${DATE_ONLY_MESSAGE}` })
  endDate!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: "Defaults to the caller's own school.",
  })
  @IsOptional()
  @IsUUID('4')
  schoolId?: string;
}

/**
 * Only name and dates are editable. Status changes go through the activate and
 * archive endpoints, and a year cannot be moved between schools — hence no
 * `schoolId` here.
 */
export class UpdateAcademicYearDto {
  @ApiPropertyOptional({ example: '2025-2026' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: `startDate: ${DATE_ONLY_MESSAGE}` })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: `endDate: ${DATE_ONLY_MESSAGE}` })
  endDate?: string;
}
