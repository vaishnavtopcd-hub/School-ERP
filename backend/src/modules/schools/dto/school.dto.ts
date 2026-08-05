import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '@/common/dto';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '@/modules/auth/dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSchoolDto {
  @ApiProperty({ example: 'St. Xavier High School' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trim)
  name!: string;

  @ApiProperty({
    example: 'SXHS',
    description: 'Short unique code. Uppercase letters, digits, and dashes.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'code must contain only uppercase letters, digits, and dashes',
  })
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  code!: string;

  @ApiPropertyOptional({ example: 'office@sxhs.edu' })
  @IsOptional()
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(255)
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @ApiPropertyOptional({ example: '+91 22 1234 5678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trim)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trim)
  address?: string;
}

export class UpdateSchoolDto extends PartialType(OmitType(CreateSchoolDto, ['code'] as const)) {
  @ApiPropertyOptional({ description: 'Deactivating blocks sign-in for the whole school.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Appointing a school's first administrator.
 *
 * Kept separate from `CreateSchoolDto` because it is a different privilege:
 * creating an empty school is harmless, minting an account that controls it is
 * not. Both are platform-operator actions, but they audit separately.
 */
export class CreateSchoolAdminDto {
  @ApiProperty({ example: 'principal@sxhs.edu' })
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(255)
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({ example: 'Meera' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trim)
  firstName!: string;

  @ApiProperty({ example: 'Nair' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trim)
  lastName!: string;

  @ApiProperty({
    example: 'Initial1!Password',
    minLength: 12,
    description: 'Initial password. Convey it out of band.',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password!: string;
}

export class ListSchoolsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;
}

export class SchoolResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiPropertyOptional({ nullable: true }) email!: string | null;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) address!: string | null;
  @ApiProperty() isActive!: boolean;

  @ApiProperty({ description: 'Active, non-deleted user accounts in this school' })
  userCount!: number;

  @ApiProperty({ description: 'Roles defined for this school' })
  roleCount!: number;

  @ApiProperty({ description: 'True once at least one administrator has been appointed' })
  hasAdmin!: boolean;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
