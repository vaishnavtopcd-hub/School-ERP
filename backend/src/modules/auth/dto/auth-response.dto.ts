import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SystemRoleKey, ThemePreference } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'teacher@school-erp.local' }) email!: string;
  @ApiProperty({ example: 'Asha' }) firstName!: string;
  @ApiProperty({ example: 'Rao' }) lastName!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) schoolId!: string | null;

  // --- Profile -------------------------------------------------------------
  // Returned here rather than from a separate endpoint because the client
  // already refetches this on every session restore, so the avatar and address
  // arrive with the session instead of costing a second round trip.

  @ApiPropertyOptional({ example: '+91 98765 43210', nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ description: 'Avatar as a data URL.', nullable: true })
  avatarUrl!: string | null;

  @ApiPropertyOptional({ example: '14 Palm Grove', nullable: true }) addressLine1!: string | null;
  @ApiPropertyOptional({ example: 'Near the church', nullable: true }) addressLine2!: string | null;
  @ApiPropertyOptional({ example: 'Kochi', nullable: true }) city!: string | null;
  @ApiPropertyOptional({ example: 'Kerala', nullable: true }) state!: string | null;
  @ApiPropertyOptional({ example: '682001', nullable: true }) postalCode!: string | null;
  @ApiPropertyOptional({ example: 'India', nullable: true }) country!: string | null;

  @ApiPropertyOptional({
    enum: ThemePreference,
    nullable: true,
    description: 'NULL means follow the operating system.',
  })
  themePreference!: ThemePreference | null;

  @ApiProperty({
    example: ['Headmaster'],
    isArray: true,
    type: String,
    description: 'Display names of the roles held. Authored per school — do not branch on these.',
  })
  roles!: string[];

  @ApiProperty({
    enum: SystemRoleKey,
    isArray: true,
    description: 'Platform-level role kinds held, if any. This is what clients may branch on.',
  })
  systemKeys!: SystemRoleKey[];

  @ApiProperty({ example: ['user:read'], isArray: true, type: String }) permissions!: string[];
}

export class LoginResponseDto {
  @ApiProperty({ description: 'Short-lived bearer token. Hold in memory only.' })
  accessToken!: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class RefreshResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Password updated' })
  message!: string;
}
