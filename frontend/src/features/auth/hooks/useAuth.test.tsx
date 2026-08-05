import { configureStore } from '@reduxjs/toolkit';
import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLES, type AuthUser } from '@/shared/types';

import { authReducer, sessionEstablished } from '../store/auth.slice';
import { useAuth } from './useAuth';

/**
 * These mirror backend/src/common/guards/roles.guard.spec.ts — the client-side
 * checks must agree with the server, or the UI shows actions the API rejects.
 */
function renderUseAuth(user: Partial<AuthUser> | null) {
  const store = configureStore({ reducer: { auth: authReducer } });

  if (user) {
    store.dispatch(
      sessionEstablished({
        id: 'u1',
        email: 'user@school-erp.local',
        firstName: 'Test',
        lastName: 'User',
        schoolId: 's1',
        roles: [],
        systemKeys: [],
        permissions: [],
        // Profile fields are irrelevant to the RBAC checks under test, but the
        // slice takes a whole AuthUser — so they are filled in as "unset".
        phone: null,
        avatarUrl: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        themePreference: null,
        ...user,
      }),
    );
  }

  const wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );

  return renderHook(() => useAuth(), { wrapper }).result;
}

describe('useAuth', () => {
  it('reports no session when no user is loaded', () => {
    const { current } = renderUseAuth(null);
    expect(current.isAuthenticated).toBe(false);
    expect(current.hasSystemRole(SYSTEM_ROLES.SCHOOL_ADMIN)).toBe(false);
    expect(current.hasPermission('student:read')).toBe(false);
  });

  it('grants the platform operator everything', () => {
    const { current } = renderUseAuth({ systemKeys: [SYSTEM_ROLES.SUPER_ADMIN] });
    expect(current.isSuperAdmin).toBe(true);
    expect(current.hasSystemRole(SYSTEM_ROLES.SCHOOL_ADMIN)).toBe(true);
    expect(current.hasPermission('anything:delete')).toBe(true);
  });

  /**
   * The school administrator is deliberately *not* a bypass — it holds every
   * school-grantable permission and passes on merit, exactly as RolesGuard
   * treats it. If this ever starts passing, the UI has drifted from the API.
   */
  it('does not treat a school administrator as a global bypass', () => {
    const { current } = renderUseAuth({
      systemKeys: [SYSTEM_ROLES.SCHOOL_ADMIN],
      permissions: ['user:read'],
    });

    expect(current.isSuperAdmin).toBe(false);
    expect(current.isSchoolAdmin).toBe(true);
    expect(current.hasPermission('user:read')).toBe(true);
    expect(current.hasPermission('school:create')).toBe(false);
  });

  it('does not treat an ordinary role as privileged', () => {
    const { current } = renderUseAuth({ roles: ['Manager', 'Headmaster'] });
    expect(current.isSuperAdmin).toBe(false);
    expect(current.hasSystemRole(SYSTEM_ROLES.SUPER_ADMIN)).toBe(false);
    expect(current.hasPermission('student:delete')).toBe(false);
  });

  it('requires every requested permission', () => {
    const { current } = renderUseAuth({ permissions: ['student:read'] });
    expect(current.hasPermission('student:read')).toBe(true);
    expect(current.hasPermission('student:read', 'student:update')).toBe(false);
  });

  it('treats resource:manage as covering any action on that resource', () => {
    const { current } = renderUseAuth({ permissions: ['student:manage'] });
    expect(current.hasPermission('student:read', 'student:delete')).toBe(true);
  });

  it('does not let a manage grant leak across resources', () => {
    const { current } = renderUseAuth({ permissions: ['student:manage'] });
    expect(current.hasPermission('fee:read')).toBe(false);
  });
});
