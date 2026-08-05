import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';

import { PERMISSIONS_KEY, ROLES_KEY } from '../constants';
import { type AuthenticatedUser } from '../types';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const buildUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
    id: 'user-1',
    email: 'user@school-erp.local',
    schoolId: 'school-1',
    roles: [],
    permissions: [],
    ...overrides,
  });

  const buildContext = (user?: AuthenticatedUser): ExecutionContext =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  /** Stubs what `@Roles()` / `@RequirePermissions()` would have set. */
  const setMetadata = (roles?: RoleName[], permissions?: string[]) => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: unknown) =>
        key === ROLES_KEY ? roles : key === PERMISSIONS_KEY ? permissions : undefined,
      );
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows a route with no role or permission metadata', () => {
    setMetadata(undefined, undefined);
    expect(guard.canActivate(buildContext(buildUser()))).toBe(true);
  });

  it('lets ADMIN through any rule', () => {
    setMetadata([RoleName.TEACHER], ['fee:delete']);
    const user = buildUser({ roles: [RoleName.ADMIN] });
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });

  it('accepts a user holding any one of the required roles', () => {
    setMetadata([RoleName.MANAGER, RoleName.HEADMASTER], undefined);
    const user = buildUser({ roles: [RoleName.HEADMASTER] });
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });

  it('rejects a user holding none of the required roles', () => {
    setMetadata([RoleName.MANAGER], undefined);
    const user = buildUser({ roles: [RoleName.TEACHER] });
    expect(() => guard.canActivate(buildContext(user))).toThrow(ForbiddenException);
  });

  it('does not treat a non-admin role as privileged', () => {
    setMetadata([RoleName.ADMIN], undefined);
    const user = buildUser({ roles: [RoleName.MANAGER, RoleName.HEADMASTER] });
    expect(() => guard.canActivate(buildContext(user))).toThrow(ForbiddenException);
  });

  it('requires every listed permission, not just one', () => {
    setMetadata(undefined, ['student:read', 'student:update']);
    const user = buildUser({ permissions: ['student:read'] });
    expect(() => guard.canActivate(buildContext(user))).toThrow(/student:update/);
  });

  it('treats a resource:manage grant as satisfying any action on that resource', () => {
    setMetadata(undefined, ['student:read', 'student:delete']);
    const user = buildUser({ permissions: ['student:manage'] });
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });

  it('does not let a manage grant leak across resources', () => {
    setMetadata(undefined, ['fee:read']);
    const user = buildUser({ permissions: ['student:manage'] });
    expect(() => guard.canActivate(buildContext(user))).toThrow(ForbiddenException);
  });

  it('rejects when both a role and a permission rule are present but only one passes', () => {
    setMetadata([RoleName.TEACHER], ['student:delete']);
    const user = buildUser({ roles: [RoleName.TEACHER], permissions: ['student:read'] });
    expect(() => guard.canActivate(buildContext(user))).toThrow(ForbiddenException);
  });

  it('rejects when the request carries no authenticated user', () => {
    setMetadata([RoleName.MANAGER], undefined);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
