import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { RoleName, UserStatus } from '@prisma/client';

import { MailService } from '@/core/mail/mail.service';
import { PrismaService } from '@/core/prisma/prisma.service';

import { AuthService } from './auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

const AUTH_CONFIG = {
  passwordResetTtlMinutes: 30,
  maxFailedLoginAttempts: 5,
  accountLockMinutes: 15,
  webAppUrl: 'http://localhost:3000',
  refreshCookieName: 'school_erp_rt',
  cookieSecure: false,
  cookieDomain: undefined,
};

/** Typed accessor for a mock's first-call argument — keeps assertions type-safe. */
function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0]?.[0] as T;
}

/** `expect.objectContaining` is typed `any`; this keeps nested matchers checkable. */
const containing = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape);

/** Asserts a Prisma `update` was called with a `data` payload containing `shape`. */
const calledWithData = (mock: jest.Mock, shape: Record<string, unknown>) =>
  expect(mock).toHaveBeenCalledWith(containing({ data: containing(shape) }));

function buildUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'teacher@school-erp.local',
    firstName: 'Asha',
    lastName: 'Rao',
    passwordHash: 'stored-hash',
    status: UserStatus.ACTIVE,
    schoolId: 'school-1',
    failedLoginAttempts: 0,
    lockedUntil: null,
    roles: [
      {
        role: {
          name: RoleName.TEACHER,
          permissions: [{ permission: { key: 'user:read' } }],
        },
      },
    ],
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: Record<string, jest.Mock>;
    refreshToken: Record<string, jest.Mock>;
    passwordResetToken: Record<string, jest.Mock>;
    auditLog: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let passwords: Record<string, jest.Mock>;
  let tokens: Record<string, jest.Mock>;
  let mail: { sendPasswordReset: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      passwordResetToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    passwords = {
      hash: jest.fn().mockResolvedValue('new-hash'),
      verify: jest.fn(),
      verifyDummy: jest.fn().mockResolvedValue(false),
      needsRehash: jest.fn().mockReturnValue(false),
    };

    tokens = {
      hashToken: jest.fn((token: string) => `hashed:${token}`),
      signAccessToken: jest.fn().mockResolvedValue('access.jwt.token'),
      getAccessTokenTtlSeconds: jest.fn().mockReturnValue(900),
      issueRefreshToken: jest
        .fn()
        .mockResolvedValue({ token: 'raw-refresh', familyId: 'fam-1', expiresAt: new Date() }),
      findRefreshToken: jest.fn(),
      revokeToken: jest.fn().mockResolvedValue(undefined),
      revokeFamily: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };

    mail = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
        { provide: MailService, useValue: mail },
        { provide: ConfigService, useValue: { get: () => AUTH_CONFIG } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  const credentials = { email: 'teacher@school-erp.local', password: 'Correct1!Password' };

  // -------------------------------------------------------------------------
  describe('login', () => {
    it('issues an access token and refresh token for valid credentials', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUserRow());
      passwords.verify.mockResolvedValue(true);

      const result = await service.login(credentials, {});

      expect(result.accessToken).toBe('access.jwt.token');
      expect(result.refreshToken.token).toBe('raw-refresh');
      expect(result.user).toMatchObject({
        email: 'teacher@school-erp.local',
        roles: [RoleName.TEACHER],
        permissions: ['user:read'],
      });
    });

    it('rejects an unknown email with the same error as a wrong password', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login(credentials, {})).rejects.toThrow(
        new UnauthorizedException('Invalid email or password'),
      );
    });

    it('spends hashing time on unknown emails so timing does not leak membership', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login(credentials, {})).rejects.toThrow(UnauthorizedException);
      expect(passwords.verifyDummy).toHaveBeenCalledWith(credentials.password);
    });

    it('rejects a wrong password and counts the attempt', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUserRow({ failedLoginAttempts: 1 }));
      passwords.verify.mockResolvedValue(false);

      await expect(service.login(credentials, {})).rejects.toThrow(UnauthorizedException);
      calledWithData(prisma.user.update, { failedLoginAttempts: 2, lockedUntil: null });
    });

    it('locks the account once the attempt limit is reached', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUserRow({ failedLoginAttempts: 4 }));
      passwords.verify.mockResolvedValue(false);

      await expect(service.login(credentials, {})).rejects.toThrow(UnauthorizedException);

      const update = firstArg<{ data: { failedLoginAttempts: number; lockedUntil: Date | null } }>(
        prisma.user.update,
      );
      expect(update.data.failedLoginAttempts).toBe(0);
      expect(update.data.lockedUntil).toBeInstanceOf(Date);
    });

    it('refuses a locked account before checking the password', async () => {
      prisma.user.findFirst.mockResolvedValue(
        buildUserRow({ lockedUntil: new Date(Date.now() + 10 * 60_000) }),
      );

      await expect(service.login(credentials, {})).rejects.toThrow(ForbiddenException);
      expect(passwords.verify).not.toHaveBeenCalled();
    });

    it('allows login again once the lock has expired', async () => {
      prisma.user.findFirst.mockResolvedValue(
        buildUserRow({ lockedUntil: new Date(Date.now() - 60_000) }),
      );
      passwords.verify.mockResolvedValue(true);

      await expect(service.login(credentials, {})).resolves.toMatchObject({
        accessToken: 'access.jwt.token',
      });
    });

    it('checks account status only after the password is proven, to avoid probing', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUserRow({ status: UserStatus.SUSPENDED }));
      passwords.verify.mockResolvedValue(false);

      // Wrong password on a suspended account looks exactly like any other
      // wrong password.
      await expect(service.login(credentials, {})).rejects.toThrow(
        new UnauthorizedException('Invalid email or password'),
      );
    });

    it('rejects a non-active account that supplied the right password', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUserRow({ status: UserStatus.SUSPENDED }));
      passwords.verify.mockResolvedValue(true);

      await expect(service.login(credentials, {})).rejects.toThrow(ForbiddenException);
    });

    it('resets the failure counter after a successful login', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUserRow({ failedLoginAttempts: 3 }));
      passwords.verify.mockResolvedValue(true);

      await service.login(credentials, {});

      calledWithData(prisma.user.update, { failedLoginAttempts: 0, lockedUntil: null });
    });

    it('upgrades a stale password hash on successful login', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUserRow());
      passwords.verify.mockResolvedValue(true);
      passwords.needsRehash.mockReturnValue(true);

      await service.login(credentials, {});

      expect(passwords.hash).toHaveBeenCalledWith(credentials.password);
      calledWithData(prisma.user.update, { passwordHash: 'new-hash' });
    });
  });

  // -------------------------------------------------------------------------
  describe('refresh', () => {
    const liveToken = {
      id: 'rt-1',
      userId: 'user-1',
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    it('rotates a valid token: revokes the old one and issues a new one', async () => {
      tokens.findRefreshToken.mockResolvedValue(liveToken);
      prisma.user.findFirst.mockResolvedValue(buildUserRow());

      const result = await service.refresh('raw', {});

      expect(tokens.revokeToken).toHaveBeenCalledWith('rt-1');
      expect(tokens.issueRefreshToken).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ familyId: 'fam-1' }),
      );
      expect(result.accessToken).toBe('access.jwt.token');
    });

    it('rejects a token that does not exist', async () => {
      tokens.findRefreshToken.mockResolvedValue(null);
      await expect(service.refresh('raw', {})).rejects.toThrow(UnauthorizedException);
    });

    it('revokes the whole family when a spent token is replayed', async () => {
      tokens.findRefreshToken.mockResolvedValue({ ...liveToken, revokedAt: new Date() });

      await expect(service.refresh('raw', {})).rejects.toThrow(UnauthorizedException);
      expect(tokens.revokeFamily).toHaveBeenCalledWith('fam-1');
      // The replay must not mint anything.
      expect(tokens.issueRefreshToken).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      tokens.findRefreshToken.mockResolvedValue({
        ...liveToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('raw', {})).rejects.toThrow(UnauthorizedException);
      expect(tokens.issueRefreshToken).not.toHaveBeenCalled();
    });

    it('revokes the family if the account is no longer active', async () => {
      tokens.findRefreshToken.mockResolvedValue(liveToken);
      prisma.user.findFirst.mockResolvedValue(buildUserRow({ status: UserStatus.SUSPENDED }));

      await expect(service.refresh('raw', {})).rejects.toThrow(UnauthorizedException);
      expect(tokens.revokeFamily).toHaveBeenCalledWith('fam-1');
    });
  });

  // -------------------------------------------------------------------------
  describe('forgotPassword', () => {
    it('does not reveal that an address is unregistered', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.forgotPassword({ email: 'nobody@x.com' }, {})).resolves.toBeUndefined();
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('creates a hashed, expiring token and emails a link', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school-erp.local',
        firstName: 'Asha',
        status: UserStatus.ACTIVE,
      });

      await service.forgotPassword({ email: 'teacher@school-erp.local' }, {});

      const created = firstArg<{ data: { tokenHash: string; expiresAt: Date } }>(
        prisma.passwordResetToken.create,
      );
      expect(created.data.tokenHash).toMatch(/^hashed:/);
      expect(created.data.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const sent = firstArg<{ resetUrl: string }>(mail.sendPasswordReset);
      expect(sent.resetUrl).toContain('http://localhost:3000/reset-password?token=');
      // The raw token goes in the mail; only its hash is stored.
      const rawToken = sent.resetUrl.split('token=')[1];
      expect(created.data.tokenHash).toBe(`hashed:${rawToken}`);
    });

    it('invalidates any previous outstanding reset link', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school-erp.local',
        firstName: 'Asha',
        status: UserStatus.ACTIVE,
      });

      await service.forgotPassword({ email: 'teacher@school-erp.local' }, {});

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', usedAt: null } }),
      );
    });

    it('stays silent for a suspended account', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'x@y.com',
        firstName: 'X',
        status: UserStatus.SUSPENDED,
      });

      await service.forgotPassword({ email: 'x@y.com' }, {});
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('resetPassword', () => {
    const payload = { token: 'a'.repeat(64), newPassword: 'BrandNew1!Pass' };

    it('sets the password and revokes every session', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });

      await service.resetPassword(payload);

      expect(passwords.hash).toHaveBeenCalledWith(payload.newPassword);
      // Marking used, updating the user, and revoking sessions must be atomic.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', revokedAt: null } }),
      );
    });

    it('rejects an unknown token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a token that has already been used', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      });

      await expect(service.resetPassword(payload)).rejects.toThrow(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      });

      await expect(service.resetPassword(payload)).rejects.toThrow(UnauthorizedException);
    });
  });

  // -------------------------------------------------------------------------
  describe('changePassword', () => {
    const payload = { currentPassword: 'Old1!Password', newPassword: 'BrandNew1!Pass' };

    beforeEach(() => {
      prisma.user.findFirstOrThrow.mockResolvedValue({ id: 'user-1', passwordHash: 'stored-hash' });
    });

    it('updates the password and revokes every session', async () => {
      passwords.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await service.changePassword('user-1', payload);

      expect(passwords.hash).toHaveBeenCalledWith(payload.newPassword);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects a wrong current password', async () => {
      passwords.verify.mockResolvedValue(false);

      await expect(service.changePassword('user-1', payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to re-set the same password', async () => {
      // Current password correct, and the new one matches the stored hash too.
      passwords.verify.mockResolvedValue(true);

      await expect(service.changePassword('user-1', payload)).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('logout', () => {
    it('revokes the family behind the presented refresh token', async () => {
      tokens.findRefreshToken.mockResolvedValue({ id: 'rt-1', familyId: 'fam-1' });

      await service.logout('raw', 'user-1');

      expect(tokens.revokeFamily).toHaveBeenCalledWith('fam-1');
    });

    it('succeeds even when no refresh token is presented', async () => {
      await expect(service.logout(undefined, 'user-1')).resolves.toBeUndefined();
      expect(tokens.revokeFamily).not.toHaveBeenCalled();
    });

    it('logoutAll revokes every session for the user', async () => {
      await service.logoutAll('user-1');
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });
});
