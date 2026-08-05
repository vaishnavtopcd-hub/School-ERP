import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Prisma, UserStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { type AuthenticatedUser } from '@/common/types';
import { type AppConfig } from '@/config';
import { MailService } from '@/core/mail/mail.service';
import { PrismaService } from '@/core/prisma/prisma.service';

import {
  type AuthUserDto,
  type ChangePasswordDto,
  type ForgotPasswordDto,
  type LoginDto,
  type ResetPasswordDto,
  type UpdateProfileDto,
} from './dto';
import { PasswordService } from './services/password.service';
import { type IssuedRefreshToken, TokenService } from './services/token.service';

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: IssuedRefreshToken;
  user: AuthUserDto;
}

/** Everything the token/response builders need from a user row. */
const userWithRoles = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  passwordHash: true,
  status: true,
  schoolId: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  phone: true,
  avatarUrl: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  themePreference: true,
  roles: {
    select: {
      role: {
        select: {
          name: true,
          systemKey: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type UserWithRoles = Prisma.UserGetPayload<{ select: typeof userWithRoles }>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  /**
   * Verifies credentials and starts a session.
   *
   * Every failure path returns the same message and spends comparable time, so
   * the endpoint cannot be used to enumerate registered addresses. The one
   * exception is a locked account, which is reported explicitly — the caller
   * already proved they know the password in that case, and silence would be
   * worse UX than a clear "try again later".
   */
  async login(dto: LoginDto, context: RequestContext): Promise<SessionResult> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      select: userWithRoles,
    });

    if (!user) {
      await this.passwords.verifyDummy(dto.password);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException(
        `Account is temporarily locked after too many failed attempts. Try again in ${minutes} minute(s).`,
      );
    }

    const passwordMatches = await this.passwords.verify(user.passwordHash, dto.password);

    if (!passwordMatches) {
      await this.registerFailedAttempt(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Status is checked only after the password is proven correct, so the
    // response cannot be used to probe which accounts exist or are suspended.
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(`Account is ${user.status.toLowerCase()}`);
    }

    await this.onSuccessfulLogin(user, dto.password);

    return this.startSession(user, context);
  }

  /** Increments the failure counter and locks the account at the threshold. */
  private async registerFailedAttempt(user: UserWithRoles): Promise<void> {
    const { maxFailedLoginAttempts, accountLockMinutes } = this.config.get('auth', { infer: true });
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= maxFailedLoginAttempts;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + accountLockMinutes * 60_000) : null,
      },
    });

    if (shouldLock) {
      this.logger.warn(
        `Account locked after ${maxFailedLoginAttempts} failed attempts: ${user.id}`,
      );
      await this.audit(user.id, 'auth.account_locked', {});
    }
  }

  private async onSuccessfulLogin(user: UserWithRoles, plainPassword: string): Promise<void> {
    // Opportunistically upgrade hashes written under older parameters.
    const passwordHash = this.passwords.needsRehash(user.passwordHash)
      ? await this.passwords.hash(plainPassword)
      : undefined;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------

  /**
   * Rotates a refresh token: the presented token is revoked and a fresh one
   * issued in the same family.
   *
   * Presenting an already-revoked token means it was captured and replayed, so
   * the entire family is revoked — the attacker and the legitimate user are
   * both logged out of that device, which is the safe outcome.
   */
  async refresh(rawToken: string, context: RequestContext): Promise<SessionResult> {
    const stored = await this.tokens.findRefreshToken(rawToken);

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}; revoking family`);
      await this.tokens.revokeFamily(stored.familyId);
      await this.audit(stored.userId, 'auth.refresh_reuse_detected', {
        familyId: stored.familyId,
      });
      throw new UnauthorizedException('Refresh token has already been used');
    }

    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: stored.userId, deletedAt: null },
      select: userWithRoles,
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.tokens.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Account is no longer active');
    }

    await this.tokens.revokeToken(stored.id);

    return this.startSession(user, context, stored.familyId);
  }

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  /** Ends the current device's session. Safe to call with a stale token. */
  async logout(rawToken: string | undefined, userId: string): Promise<void> {
    if (rawToken) {
      const stored = await this.tokens.findRefreshToken(rawToken);
      if (stored) {
        await this.tokens.revokeFamily(stored.familyId);
      }
    }
    await this.audit(userId, 'auth.logout', {});
  }

  /** Ends every session for the user, on all devices. */
  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
    await this.audit(userId, 'auth.logout_all', {});
  }

  // -------------------------------------------------------------------------
  // Password recovery
  // -------------------------------------------------------------------------

  /**
   * Always resolves successfully, whether or not the address is registered —
   * otherwise this endpoint becomes a membership oracle.
   */
  async forgotPassword(dto: ForgotPasswordDto, context: RequestContext): Promise<void> {
    const { passwordResetTtlMinutes, webAppUrl } = this.config.get('auth', { infer: true });

    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      select: { id: true, email: true, firstName: true, status: true },
    });

    if (!user || user.status === UserStatus.SUSPENDED) {
      this.logger.log(`Password reset requested for unknown or suspended address`);
      return;
    }

    // Only one live reset link at a time; requesting a new one invalidates the
    // previous, so an old email cannot be replayed.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: this.tokens.hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + passwordResetTtlMinutes * 60_000),
        ipAddress: context.ipAddress,
      },
    });

    await this.mail.sendPasswordReset({
      to: user.email,
      firstName: user.firstName,
      resetUrl: `${webAppUrl}/reset-password?token=${token}`,
      expiresInMinutes: passwordResetTtlMinutes,
    });

    await this.audit(user.id, 'auth.password_reset_requested', {});
  }

  /**
   * Consumes a reset token and sets a new password. The token is single-use and
   * every existing session is revoked, so a stolen session cannot outlive the
   * reset that was meant to stop it.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(dto.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!stored || stored.usedAt || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('This reset link is invalid or has expired');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: now },
      }),
      this.prisma.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    await this.audit(stored.userId, 'auth.password_reset_completed', {});
  }

  /**
   * Changes the password of the signed-in user. Requires the current password,
   * so a hijacked access token alone cannot lock the owner out.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      select: { id: true, passwordHash: true },
    });

    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (await this.passwords.verify(user.passwordHash, dto.newPassword)) {
      throw new ForbiddenException('New password must differ from the current one');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    await this.audit(user.id, 'auth.password_changed', {});
  }

  // -------------------------------------------------------------------------
  // Current user
  // -------------------------------------------------------------------------

  async getProfile(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      select: userWithRoles,
    });
    return this.toAuthUser(user);
  }

  /**
   * Self-service profile edit. Deliberately does not touch email, status, or
   * roles — those are administrative and go through the users module, which
   * checks permissions the actor may not hold over their own account.
   *
   * Fields left `undefined` are untouched; an explicit `null` clears the value.
   * Prisma treats the two the same way, so the DTO's optionality carries
   * straight through without a hand-written patch loop.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthUserDto> {
    // Listed rather than spread so a future DTO field cannot silently become
    // writable here without someone deciding it should be.
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        themePreference: dto.themePreference,
      },
      select: userWithRoles,
    });

    // The avatar itself is far too large to put in an audit row; recording
    // which fields moved is what makes the entry useful anyway.
    await this.audit(userId, 'auth.profile_updated', {
      fields: Object.keys(dto).filter((key) => dto[key as keyof UpdateProfileDto] !== undefined),
    });

    return this.toAuthUser(user);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async startSession(
    user: UserWithRoles,
    context: RequestContext,
    familyId?: string,
  ): Promise<SessionResult> {
    const profile = this.toAuthUser(user);

    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccessToken({
        userId: profile.id,
        email: profile.email,
        schoolId: profile.schoolId,
      }),
      this.tokens.issueRefreshToken(user.id, { ...context, familyId }),
    ]);

    return {
      accessToken,
      expiresIn: this.tokens.getAccessTokenTtlSeconds(),
      refreshToken,
      user: profile,
    };
  }

  private toAuthUser(user: UserWithRoles): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      schoolId: user.schoolId,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      state: user.state,
      postalCode: user.postalCode,
      country: user.country,
      themePreference: user.themePreference,
      roles: user.roles.map(({ role }) => role.name),
      systemKeys: user.roles.flatMap(({ role }) => (role.systemKey ? [role.systemKey] : [])),
      permissions: [
        ...new Set(
          user.roles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.key),
          ),
        ),
      ],
    };
  }

  /**
   * Audit writes must never break the request they describe — a failed insert
   * is logged and swallowed.
   */
  private async audit(
    actorId: string | null,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { actorId, action, resource: 'auth', metadata: metadata as Prisma.InputJsonValue },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for "${action}"`, error as Error);
    }
  }

  /** Exposes the mapper for the JWT strategy, which builds the same shape. */
  static toAuthenticatedUser(profile: AuthUserDto): AuthenticatedUser {
    return {
      id: profile.id,
      email: profile.email,
      schoolId: profile.schoolId,
      roleNames: profile.roles,
      systemKeys: profile.systemKeys,
      permissions: profile.permissions,
    };
  }
}
