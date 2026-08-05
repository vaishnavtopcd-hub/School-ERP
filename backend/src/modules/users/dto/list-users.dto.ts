import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto';

/**
 * Columns a client may sort by.
 *
 * This whitelist is load-bearing, not cosmetic: `sortBy` reaches Prisma's
 * `orderBy`, and an unrecognised field name would blow up the query at runtime.
 */
export const USER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'email',
  'firstName',
  'lastName',
  'status',
  'lastLoginAt',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export class ListUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: USER_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS, {
    message: `sortBy must be one of: ${USER_SORT_FIELDS.join(', ')}`,
  })
  override sortBy?: UserSortField = 'createdAt';

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only users holding this role' })
  @IsOptional()
  @IsUUID('4')
  roleId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  schoolId?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Include soft-deleted accounts. Off by default.',
  })
  @IsOptional()
  @Transform(({ value }): unknown => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({
    default: false,
    description:
      "Omit the caller's own account. For management screens, where acting on " +
      'yourself is refused anyway. Left off by default so counts and reports ' +
      'stay truthful.',
  })
  @IsOptional()
  @Transform(({ value }): unknown => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  excludeSelf?: boolean = false;
}
