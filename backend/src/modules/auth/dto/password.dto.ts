import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Shared password strength policy. Applied wherever a password is *set* —
 * never on login. Keep the message specific so the UI can show it verbatim.
 */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;
export const PASSWORD_RULE_MESSAGE =
  'Password must contain an uppercase letter, a lowercase letter, a number, and a symbol';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'teacher@school-erp.local' })
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(255)
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Raw token from the emailed reset link' })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @ApiProperty({ example: 'N3wStr0ng!Pass', minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'The password currently in use' })
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'N3wStr0ng!Pass', minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword!: string;
}
