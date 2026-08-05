import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SystemRoleKey, UserStatus } from '@prisma/client';

/** A role as held by a user. `name` is display-only — branch on `systemKey`. */
export class UserRoleDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Headmaster' }) name!: string;
  @ApiPropertyOptional({ enum: SystemRoleKey, nullable: true })
  systemKey!: SystemRoleKey | null;
}

/**
 * The public shape of a user. Note what is absent: `passwordHash`,
 * `failedLoginAttempts`, and the raw `lockedUntil` timestamp never leave the
 * server. Lock state is surfaced as a single boolean instead.
 */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'asha.rao@school-erp.local' }) email!: string;
  @ApiProperty({ example: 'Asha' }) firstName!: string;
  @ApiProperty({ example: 'Rao' }) lastName!: string;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) schoolId!: string | null;
  @ApiProperty({
    isArray: true,
    type: () => UserRoleDto,
    description: 'Roles held. Ids are stable; names are admin-authored and renameable.',
  })
  roles!: UserRoleDto[];

  @ApiProperty({ description: 'True while the account is locked out after failed logins' })
  isLocked!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastLoginAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Set when the account has been soft-deleted',
  })
  deletedAt!: Date | null;
}

export class RoleOptionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Headmaster' }) name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ enum: SystemRoleKey, nullable: true })
  systemKey!: SystemRoleKey | null;
  @ApiProperty({ description: 'System roles cannot be edited or deleted' }) isSystem!: boolean;
  @ApiProperty({ isArray: true, type: String }) permissions!: string[];
}
