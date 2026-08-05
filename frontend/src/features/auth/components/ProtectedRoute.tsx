import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import type { PropsWithChildren } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { ROUTES } from '@/shared/constants';
import type { Permission, SystemRoleKey } from '@/shared/types';

import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps extends PropsWithChildren {
  /**
   * User needs ANY of these platform-level role kinds.
   *
   * Note there is no gate on role *names*: those are authored per school, so a
   * route cannot meaningfully name one. Gate on `permissions` instead.
   */
  systemRoles?: SystemRoleKey[];
  /** User needs ALL of these permissions. */
  permissions?: Permission[];
}

/**
 * Route-level authentication and RBAC gate. Use as a layout route:
 *
 *   <Route element={<ProtectedRoute permissions={['student:read']} />}>
 *     <Route path="/students" element={<StudentsPage />} />
 *   </Route>
 */
export function ProtectedRoute({ systemRoles, permissions, children }: ProtectedRouteProps) {
  const { isAuthenticated, isInitializing, hasSystemRole, hasPermission } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <Box className="flex h-screen items-center justify-center">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Remember where they were headed so login can send them back.
    return <Navigate to={ROUTES.auth.login} state={{ from: location }} replace />;
  }

  const roleOk = !systemRoles?.length || hasSystemRole(...systemRoles);
  const permissionOk = !permissions?.length || hasPermission(...permissions);

  if (!roleOk || !permissionOk) {
    return <Navigate to={ROUTES.forbidden} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
