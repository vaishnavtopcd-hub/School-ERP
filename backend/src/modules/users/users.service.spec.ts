import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { RoleName, UserStatus } from '@prisma/client';

import { PrismaService } from '@/core/prisma/prisma.service';
import { PasswordService } from '@/modules/auth/services/password.service';
import { TokenService } from '@/modules/auth/services/token.service';

import { type Actor, UsersService } from './users.service';

const ADMIN_ACTOR: Actor = { id: 'admin-1', roles: [RoleName.ADMIN] };
const MANAGER_ACTOR: Actor = { id: 'manager-1', roles: [RoleName.MANAGER] };

/** Reads a mock's first-call argument as `unknown`, so the cast at each call site is checked. */
const firstArg = (mock: jest.Mock): unknown => (mock.mock.calls as unknown[][])[0]?.[0];

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'asha@school-erp.local',
    firstName: 'Asha',
    lastName: 'Rao',
    phone: null,
    status: UserStatus.ACTIVE,
    schoolId: 'school-1',
    lastLoginAt: null,
    lockedUntil: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    roles: [{ role: { name: RoleName.TEACHER } }],
    ...overrides,
  };
}

const adminRow = (overrides: Record<string, unknown> = {}) =>
  buildRow({ roles: [{ role: { name: RoleName.ADMIN } }], ...overrides });

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: Record<string, jest.Mock>;
    role: Record<string, jest.Mock>;
    userRole: Record<string, jest.Mock>;
    refreshToken: Record<string, jest.Mock>;
    auditLog: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let tokens: Record<string, jest.Mock>;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      role: {
        findMany: jest
          .fn()
          .mockImplementation(({ where }: { where?: { name?: { in: string[] } } }) =>
            Promise.resolve((where?.name?.in ?? []).map((name) => ({ id: `role-${name}`, name }))),
          ),
      },
      userRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      // Mirrors Prisma: resolves the array of operations it is handed.
      $transaction: jest.fn().mockImplementation((ops: unknown) => Promise.resolve(ops)),
    };

    tokens = {
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: { hash: jest.fn().mockResolvedValue('hashed') } },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  // -------------------------------------------------------------------------
  describe('findAll', () => {
    it('paginates and reports accurate metadata', async () => {
      prisma.$transaction.mockResolvedValue([42, [buildRow()]]);

      const result = await service.findAll({
        page: 2,
        limit: 20,
        skip: 20,
        sortOrder: 'desc',
      } as never);

      expect(result.meta).toMatchObject({
        page: 2,
        limit: 20,
        total: 42,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
      expect(result.items).toHaveLength(1);
    });

    it('excludes soft-deleted users by default', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);
      await service.findAll({ page: 1, limit: 20, skip: 0, sortOrder: 'desc' } as never);

      const args = firstArg(prisma.user.findMany) as {
        where: { AND: Record<string, unknown>[] };
      };
      expect(args.where.AND).toContainEqual({ deletedAt: null });
    });

    it('includes soft-deleted users when asked', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);
      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        sortOrder: 'desc',
        includeDeleted: true,
      } as never);

      const args = firstArg(prisma.user.findMany) as {
        where: Record<string, unknown>;
      };
      expect(JSON.stringify(args.where)).not.toContain('deletedAt');
    });

    it('searches name and email case-insensitively without dropping other filters', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);
      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        sortOrder: 'desc',
        search: 'rao',
        status: UserStatus.ACTIVE,
      } as never);

      const args = firstArg(prisma.user.findMany) as {
        where: { AND: Record<string, unknown>[] };
      };
      // The OR must be a sibling of the status filter, not a replacement for it.
      expect(args.where.AND).toContainEqual({ status: UserStatus.ACTIVE });
      expect(args.where.AND).toContainEqual({
        OR: [
          { firstName: { contains: 'rao', mode: 'insensitive' } },
          { lastName: { contains: 'rao', mode: 'insensitive' } },
          { email: { contains: 'rao', mode: 'insensitive' } },
        ],
      });
    });

    it('never leaks the password hash or the raw lockout timestamp', async () => {
      prisma.$transaction.mockResolvedValue([
        1,
        [buildRow({ lockedUntil: new Date(Date.now() + 60_000) })],
      ]);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        sortOrder: 'desc',
      } as never);

      const serialised = JSON.stringify(result.items[0]);
      expect(serialised).not.toContain('passwordHash');
      expect(serialised).not.toContain('lockedUntil');
      expect(result.items[0].isLocked).toBe(true);
    });

    it('reports an expired lockout as unlocked', async () => {
      prisma.$transaction.mockResolvedValue([
        1,
        [buildRow({ lockedUntil: new Date(Date.now() - 60_000) })],
      ]);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        sortOrder: 'desc',
      } as never);

      expect(result.items[0].isLocked).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('create', () => {
    const dto = {
      email: 'new@school-erp.local',
      firstName: 'New',
      lastName: 'User',
      password: 'Initial1!Password',
      roles: [RoleName.TEACHER],
    };

    it('hashes the password and attaches the requested roles', async () => {
      prisma.user.create.mockResolvedValue(buildRow());

      await service.create(dto, ADMIN_ACTOR);

      const args = firstArg(prisma.user.create) as {
        data: { passwordHash: string; roles: { create: { roleId: string }[] } };
      };
      expect(args.data.passwordHash).toBe('hashed');
      expect(args.data.roles.create).toEqual([{ roleId: `role-${RoleName.TEACHER}` }]);
    });

    it('never stores the raw password', async () => {
      prisma.user.create.mockResolvedValue(buildRow());
      await service.create(dto, ADMIN_ACTOR);

      expect(JSON.stringify(firstArg(prisma.user.create))).not.toContain(dto.password);
    });

    it('rejects a duplicate email before touching the database', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'someone-else' });

      await expect(service.create(dto as never, ADMIN_ACTOR)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('stops a non-admin from creating an ADMIN account', async () => {
      await expect(
        service.create({ ...dto, roles: [RoleName.ADMIN] }, MANAGER_ACTOR),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('lets an admin create another admin', async () => {
      prisma.user.create.mockResolvedValue(adminRow());

      await expect(
        service.create({ ...dto, roles: [RoleName.ADMIN] }, ADMIN_ACTOR),
      ).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('update', () => {
    it('rejects an email already taken by someone else', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow());
      prisma.user.findUnique.mockResolvedValue({ id: 'other-user' });

      await expect(service.update('user-1', { email: 'taken@x.com' }, ADMIN_ACTOR)).rejects.toThrow(
        ConflictException,
      );
    });

    it('allows a user to keep their own email', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow());
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue(buildRow());

      await expect(
        service.update('user-1', { email: 'asha@school-erp.local' }, ADMIN_ACTOR),
      ).resolves.toBeDefined();
    });

    it('404s for a soft-deleted user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.update('gone', { firstName: 'X' }, ADMIN_ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('setStatus', () => {
    it('disabling revokes every session', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow());
      prisma.user.update.mockResolvedValue(buildRow({ status: UserStatus.INACTIVE }));

      await service.setStatus('user-1', { status: UserStatus.INACTIVE }, ADMIN_ACTOR);

      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('re-enabling clears a brute-force lockout', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow({ status: UserStatus.INACTIVE }));
      prisma.user.update.mockResolvedValue(buildRow());

      await service.setStatus('user-1', { status: UserStatus.ACTIVE }, ADMIN_ACTOR);

      const args = firstArg(prisma.user.update) as {
        data: { failedLoginAttempts: number; lockedUntil: null };
      };
      expect(args.data.failedLoginAttempts).toBe(0);
      expect(args.data.lockedUntil).toBeNull();
      expect(tokens.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('refuses to let an admin disable themselves', async () => {
      prisma.user.findFirst.mockResolvedValue(adminRow({ id: 'admin-1' }));

      await expect(
        service.setStatus('admin-1', { status: UserStatus.INACTIVE }, ADMIN_ACTOR),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses to disable the last remaining administrator', async () => {
      prisma.user.findFirst.mockResolvedValue(adminRow({ id: 'other-admin' }));
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.setStatus('other-admin', { status: UserStatus.INACTIVE }, ADMIN_ACTOR),
      ).rejects.toThrow(ConflictException);
    });

    it('allows disabling an admin when another remains', async () => {
      prisma.user.findFirst.mockResolvedValue(adminRow({ id: 'other-admin' }));
      prisma.user.count.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue(adminRow({ status: UserStatus.INACTIVE }));

      await expect(
        service.setStatus('other-admin', { status: UserStatus.INACTIVE }, ADMIN_ACTOR),
      ).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('soft-deletes, releases the email, and revokes sessions', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow());

      await service.remove('user-1', ADMIN_ACTOR);

      const update = firstArg(prisma.user.update) as {
        data: { deletedAt: Date; email: string; status: UserStatus };
      };
      expect(update.data.deletedAt).toBeInstanceOf(Date);
      expect(update.data.status).toBe(UserStatus.INACTIVE);
      // Address freed for reuse, original still recoverable from the tombstone.
      expect(update.data.email).not.toBe('asha@school-erp.local');
      expect(update.data.email).toContain('asha@school-erp.local');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('keeps the tombstone within the column limit', async () => {
      const longEmail = `${'a'.repeat(240)}@x.com`;
      prisma.user.findFirst.mockResolvedValue(buildRow({ email: longEmail }));

      await service.remove('user-1', ADMIN_ACTOR);

      const update = firstArg(prisma.user.update) as { data: { email: string } };
      expect(update.data.email.length).toBeLessThanOrEqual(255);
    });

    it('refuses self-deletion', async () => {
      prisma.user.findFirst.mockResolvedValue(adminRow({ id: 'admin-1' }));

      await expect(service.remove('admin-1', ADMIN_ACTOR)).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to delete the last administrator', async () => {
      prisma.user.findFirst.mockResolvedValue(adminRow({ id: 'other-admin' }));
      prisma.user.count.mockResolvedValue(0);

      await expect(service.remove('other-admin', ADMIN_ACTOR)).rejects.toThrow(ConflictException);
    });

    it('does not apply last-admin protection to non-admins', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow());
      prisma.user.count.mockResolvedValue(0);

      await expect(service.remove('user-1', ADMIN_ACTOR)).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('resetPassword', () => {
    it('sets the hash, clears the lockout, and ends every session', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow());

      await service.resetPassword('user-1', { newPassword: 'Temp1!Password' }, ADMIN_ACTOR);

      const update = firstArg(prisma.user.update) as {
        data: {
          passwordHash: string;
          passwordChangedAt: Date;
          failedLoginAttempts: number;
          lockedUntil: null;
        };
      };
      expect(update.data.passwordHash).toBe('hashed');
      // passwordChangedAt is what invalidates already-issued access tokens.
      expect(update.data.passwordChangedAt).toBeInstanceOf(Date);
      expect(update.data.lockedUntil).toBeNull();
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('404s for an unknown user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('nope', { newPassword: 'Temp1!Password' }, ADMIN_ACTOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  describe('assignRoles', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(buildRow());
    });

    it('replaces the whole role set', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow());

      await service.assignRoles('user-1', { roles: [RoleName.HEADMASTER] }, ADMIN_ACTOR);

      expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      const created = firstArg(prisma.userRole.createMany) as {
        data: { roleId: string }[];
      };
      expect(created.data).toEqual([{ userId: 'user-1', roleId: `role-${RoleName.HEADMASTER}` }]);
    });

    it('accepts an empty array to strip every role', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow());

      await service.assignRoles('user-1', { roles: [] }, ADMIN_ACTOR);

      expect(prisma.userRole.deleteMany).toHaveBeenCalled();
      const created = firstArg(prisma.userRole.createMany) as { data: unknown[] };
      expect(created.data).toEqual([]);
    });

    it('stops a non-admin from granting ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow());

      await expect(
        service.assignRoles('user-1', { roles: [RoleName.ADMIN] }, MANAGER_ACTOR),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
    });

    it('refuses to let an admin strip their own ADMIN role', async () => {
      prisma.user.findFirst.mockResolvedValue(adminRow({ id: 'admin-1' }));

      await expect(
        service.assignRoles('admin-1', { roles: [RoleName.TEACHER] }, ADMIN_ACTOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses to demote the last administrator', async () => {
      prisma.user.findFirst.mockResolvedValue(adminRow({ id: 'other-admin' }));
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.assignRoles('other-admin', { roles: [RoleName.TEACHER] }, ADMIN_ACTOR),
      ).rejects.toThrow(ConflictException);
    });

    it('allows an admin to keep ADMIN while gaining another role', async () => {
      prisma.user.findFirst.mockResolvedValue(adminRow({ id: 'admin-1' }));

      await expect(
        service.assignRoles(
          'admin-1',
          { roles: [RoleName.ADMIN, RoleName.HEADMASTER] },
          ADMIN_ACTOR,
        ),
      ).resolves.toBeDefined();
    });

    it('revokes sessions so the new privileges are re-established cleanly', async () => {
      prisma.user.findFirst.mockResolvedValue(buildRow());

      await service.assignRoles('user-1', { roles: [RoleName.HEADMASTER] }, ADMIN_ACTOR);

      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });
});
