import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMediumDto {
  @ApiProperty({ example: 'Malayalam', description: 'Unique within the school.' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Inactive mediums stay attached to existing sections but are not offered.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateMediumDto extends PartialType(CreateMediumDto) {}

export class MediumResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Malayalam' }) name!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ format: 'uuid' }) schoolId!: string;

  @ApiProperty({ description: 'Sections currently taught in this medium' })
  sectionCount!: number;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
