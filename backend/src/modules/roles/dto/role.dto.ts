import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SystemRoleKey } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRoleDto {
  @ApiProperty({
    example: 'Vice Principal',
    description: 'Free text, unique within the school.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Transform(trim)
  name!: string;

  @ApiPropertyOptional({ example: 'Deputises for the headmaster.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  description?: string;

  @ApiProperty({
    isArray: true,
    type: String,
    example: ['user:read', 'class:read'],
    description:
      'Permission keys this role grants. You may only grant permissions you hold yourself.',
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissions!: string[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Vice Principal' }) name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) schoolId!: string | null;

  @ApiPropertyOptional({ enum: SystemRoleKey, nullable: true })
  systemKey!: SystemRoleKey | null;

  @ApiProperty({ description: 'System roles cannot be renamed, re-permissioned, or deleted' })
  isSystem!: boolean;

  @ApiProperty({ isArray: true, type: String }) permissions!: string[];

  @ApiProperty({ description: 'How many users currently hold this role' })
  userCount!: number;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

export class PermissionOptionDto {
  @ApiProperty({ example: 'class:read' }) key!: string;
  @ApiProperty({ example: 'class' }) resource!: string;
  @ApiProperty({ example: 'read' }) action!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;

  @ApiProperty({ description: 'False when the caller cannot grant this permission' })
  grantable!: boolean;
}
