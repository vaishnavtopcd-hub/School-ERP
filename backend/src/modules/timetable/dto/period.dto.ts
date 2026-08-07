import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** 24-hour `HH:mm`. Anchored, so "9:00" and "09:00:00" are both rejected. */
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePeriodDto {
  @ApiProperty({ example: 'Period 1' })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiProperty({ example: 1, minimum: 1, description: 'Order through the day. Unique per school.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  sequence!: number;

  @ApiProperty({ example: '09:00', description: '24-hour HH:mm.' })
  @IsString()
  @Transform(trim)
  @Matches(CLOCK_TIME, { message: 'startTime must be a 24-hour time, e.g. 09:00' })
  startTime!: string;

  @ApiProperty({ example: '09:45', description: '24-hour HH:mm. Must be after startTime.' })
  @IsString()
  @Transform(trim)
  @Matches(CLOCK_TIME, { message: 'endTime must be a 24-hour time, e.g. 09:45' })
  endTime!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Breaks appear in the grid but nothing may be scheduled into them.',
  })
  @IsOptional()
  @IsBoolean()
  isBreak?: boolean = false;
}

export class UpdatePeriodDto extends PartialType(CreatePeriodDto) {}

export class PeriodResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Period 1' }) name!: string;
  @ApiProperty({ example: 1 }) sequence!: number;
  @ApiProperty({ example: '09:00' }) startTime!: string;
  @ApiProperty({ example: '09:45' }) endTime!: string;
  @ApiProperty() isBreak!: boolean;
  @ApiProperty({ format: 'uuid' }) schoolId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
