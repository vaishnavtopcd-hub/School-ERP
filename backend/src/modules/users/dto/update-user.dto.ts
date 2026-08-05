import { ApiProperty } from '@nestjs/swagger';
import { OmitType, PartialType } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '@/modules/auth/dto';

import { CreateUserDto } from './create-user.dto';

/**
 * Profile edits only. Password, status, and roles each have their own endpoint,
 * because each is a distinct privileged action worth auditing (and permissioning)
 * separately from "fix a typo in a surname".
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'roleIds', 'status'] as const),
) {}

/**
 * PENDING is excluded: it means "signed up but not yet verified", which is not a
 * state an administrator should be able to push an account back into.
 */
export const ASSIGNABLE_STATUSES = [
  UserStatus.ACTIVE,
  UserStatus.INACTIVE,
  UserStatus.SUSPENDED,
] as const;

export type AssignableStatus = (typeof ASSIGNABLE_STATUSES)[number];

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ASSIGNABLE_STATUSES })
  @IsIn(ASSIGNABLE_STATUSES, {
    message: `status must be one of: ${ASSIGNABLE_STATUSES.join(', ')}`,
  })
  status!: AssignableStatus;
}

export class AssignRolesDto {
  @ApiProperty({
    isArray: true,
    type: String,
    format: 'uuid',
    description:
      'Ids of roles to hold, replacing the full set. Send an empty array to strip every role. ' +
      "Every id must belong to the target user's school.",
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  roleIds!: string[];
}

export class AdminResetPasswordDto {
  @ApiProperty({
    example: 'Temp1!Password',
    minLength: 12,
    description: 'Ends every session for the account. Convey the new password out of band.',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword!: string;
}
