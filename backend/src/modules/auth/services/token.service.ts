import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { type JwtPayload } from '@/common/types';
import { type AppConfig } from '@/config';
import { PrismaService } from '@/core/prisma/prisma.service';

/**
 * Roles and permissions are deliberately absent: JwtStrategy re-reads them from
 * the database on every request, so embedding them here would only create a
 * second, staler copy of the same decision.
 */
export interface AccessTokenClaims {
  userId: string;
  email: string;
  schoolId: string | null;
}

export interface IssuedRefreshToken {
  /** Raw value — returned to the client once, never stored. */
  token: string;
  familyId: string;
  expiresAt: Date;
}

/**
 * Token minting, hashing, and lifecycle.
 *
 * Access tokens are stateless JWTs. Refresh tokens are opaque 256-bit random
 * strings stored as SHA-256 digests, so the database never holds a usable
 * credential and every session can be revoked server-side.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * SHA-256 rather than Argon2: these are 256-bit random values, not
   * user-chosen secrets, so there is nothing to brute-force and lookups need to
   * stay indexable.
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    const payload: JwtPayload = {
      sub: claims.userId,
      email: claims.email,
      schoolId: claims.schoolId,
    };
    return this.jwt.signAsync(payload);
  }

  /** Access token lifetime in seconds, for the client's refresh scheduling. */
  getAccessTokenTtlSeconds(): number {
    return this.parseDuration(this.config.get('jwt', { infer: true }).accessExpiresIn);
  }

  /**
   * Creates and persists a refresh token. Pass an existing `familyId` when
   * rotating so the lineage is preserved for reuse detection.
   */
  async issueRefreshToken(
    userId: string,
    context: { userAgent?: string; ipAddress?: string; familyId?: string },
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('hex');
    const familyId = context.familyId ?? randomUUID();
    const expiresAt = new Date(
      Date.now() +
        this.parseDuration(this.config.get('jwt', { infer: true }).refreshExpiresIn) * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        familyId,
        userAgent: context.userAgent?.slice(0, 255),
        ipAddress: context.ipAddress,
        expiresAt,
      },
    });

    return { token, familyId, expiresAt };
  }

  async findRefreshToken(rawToken: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
    });
  }

  async revokeToken(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /** Kills one rotation lineage — i.e. one device's session. */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Kills every session for a user. Used on password change/reset. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Deletes expired and long-revoked rows. Call from a scheduled job; the table
   * grows with every login otherwise.
   */
  async pruneExpired(): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }

  /**
   * Converts `15m` / `7d` / `3600` into seconds. Values are validated at boot,
   * so an unparseable one here is a programming error, not user input.
   */
  private parseDuration(value: string): number {
    const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());

    if (!match) {
      throw new Error(`Unparseable token duration: "${value}"`);
    }

    const amount = Number(match[1]);
    const unit = match[2] ?? 's';
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3_600, d: 86_400 };

    return amount * multipliers[unit];
  }
}
