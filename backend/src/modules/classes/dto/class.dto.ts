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

export class CreateClassDto {
  @ApiProperty({ example: 'Class 10' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    maximum: 20,
    description:
      'Numeric grade used for ordering only — "Class 10" must sort after "Class 9", which it ' +
      'would not alphabetically. Derived from the name when omitted, so callers normally leave ' +
      'it out.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  level?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: "Defaults to the school's currently active academic year.",
  })
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateClassDto {
  @ApiPropertyOptional({ example: 'Class 10' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ example: 10, minimum: 0, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  level?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
