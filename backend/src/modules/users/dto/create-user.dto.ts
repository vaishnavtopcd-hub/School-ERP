import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '@/modules/auth/dto';

export class CreateUserDto {
  @ApiProperty({ example: 'asha.rao@school-erp.local' })
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(255)
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({ example: 'Asha' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  firstName!: string;

  @ApiProperty({ example: 'Rao' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  lastName!: string;

  @ApiPropertyOptional({ example: '+91 98765 43210' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  phone?: string;

  @ApiProperty({
    example: 'Initial1!Password',
    minLength: 12,
    description: 'Initial password. Convey it to the user out of band.',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password!: string;

  @ApiPropertyOptional({
    enum: UserStatus,
    default: UserStatus.ACTIVE,
    description:
      'PENDING is the default for self-registration; admins usually create ACTIVE users.',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus = UserStatus.ACTIVE;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  schoolId?: string;

  @ApiPropertyOptional({
    isArray: true,
    type: String,
    format: 'uuid',
    description:
      'Ids of roles to grant on creation. Roles are per-school, so these must belong to the ' +
      "target user's school. Omit for an account with no privileges yet.",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
