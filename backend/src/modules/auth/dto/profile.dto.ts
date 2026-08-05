import { ApiPropertyOptional } from '@nestjs/swagger';
import { ThemePreference } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Ceiling for an inline avatar, in characters of the data URL.
 *
 * The client crops to 256px and re-encodes to WebP, which lands around 15-40KB;
 * this leaves generous headroom for a browser that falls back to PNG without
 * letting anyone post a megabyte into a row that is read on every `/auth/me`.
 * `main.ts` raises the body-parser limit above this so *this* is the real cap
 * and the failure is a readable 400 rather than an opaque 413.
 */
export const MAX_AVATAR_DATA_URL_LENGTH = 256_000;

/**
 * Only formats every target browser can produce from a canvas. Exported so an
 * administrator setting someone else's photo is held to the same rule as a user
 * setting their own — two patterns would drift.
 */
export const AVATAR_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Blank text fields come back from the form as `''`; storing that would make
 * "cleared" and "never filled in" two different states for no reason.
 */
const blankToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

/**
 * Self-service profile edit — what a signed-in user may change about *their own*
 * account, which is deliberately narrower than what `PATCH /users/:id` allows an
 * administrator to change.
 *
 * Email, status, and roles are absent on purpose: email is the login identity
 * and changing it needs a verification flow, and the other two are administrative.
 * Every field is optional, and an explicit `null` clears the value.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Asha', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rao', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({
    description:
      'Square avatar as a base64 data URL (png, jpeg, or webp). Send null to remove it.',
    example: 'data:image/webp;base64,UklGRi4AAABXRUJQ...',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AVATAR_DATA_URL_LENGTH, {
    message: 'Image is too large. Choose a smaller picture.',
  })
  @Matches(AVATAR_DATA_URL, { message: 'Avatar must be a png, jpeg, or webp data URL.' })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: '14 Palm Grove', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(200)
  addressLine1?: string | null;

  @ApiPropertyOptional({ example: 'Near St. Mary’s Church', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(200)
  addressLine2?: string | null;

  @ApiPropertyOptional({ example: 'Kochi', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ example: 'Kerala', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(100)
  state?: string | null;

  @ApiPropertyOptional({ example: '682001', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(20)
  postalCode?: string | null;

  @ApiPropertyOptional({ example: 'India', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(blankToNull)
  @MaxLength(100)
  country?: string | null;

  @ApiPropertyOptional({
    enum: ThemePreference,
    nullable: true,
    description: 'Pinned colour mode. Send null to follow the operating system.',
  })
  @IsOptional()
  @IsEnum(ThemePreference)
  themePreference?: ThemePreference | null;
}
