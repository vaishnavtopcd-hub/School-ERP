import { useCallback } from 'react';

import { useAppSelector } from '@/app/store/hooks';
import { SYSTEM_ROLES, type Permission, type SystemRoleKey } from '@/shared/types';

/**
 * Read-side of the session, plus the RBAC predicates the UI gates on.
 *
 * Mirrors the backend's RolesGuard: SUPER_ADMIN bypasses everything, and a
 * `resource:manage` grant satisfies any action on that resource. Note that a
 * school administrator is *not* a bypass — it holds every school-grantable
 * permission and passes on merit, exactly as the server treats it.
 *
 * These checks are for UX only — the API is the authority.
 */
export function useAuth() {
  const { user, isAuthenticated, isInitializing } = useAppSelector((state) => state.auth);

  const isSuperAdmin = user?.systemKeys.includes(SYSTEM_ROLES.SUPER_ADMIN) ?? false;
  const isSchoolAdmin = user?.systemKeys.includes(SYSTEM_ROLES.SCHOOL_ADMIN) ?? false;

  /** Checks a platform-level role kind. Role *names* are not checkable by design. */
  const hasSystemRole = useCallback(
    (...keys: SystemRoleKey[]) =>
      isSuperAdmin || keys.some((key) => user?.systemKeys.includes(key)),
    [user, isSuperAdmin],
  );

  const hasPermission = useCallback(
    (...permissions: Permission[]) => {
      if (isSuperAdmin) return true;
      if (!user) return false;

      return permissions.every((permission) => {
        if (user.permissions.includes(permission)) return true;
        const [resource] = permission.split(':');
        return user.permissions.includes(`${resource}:manage`);
      });
    },
    [user, isSuperAdmin],
  );

  return {
    user,
    isAuthenticated,
    isInitializing,
    isSuperAdmin,
    isSchoolAdmin,
    hasSystemRole,
    hasPermission,
  };
}
