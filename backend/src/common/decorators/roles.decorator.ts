import { SetMetadata } from '@nestjs/common';
import { type SystemRoleKey } from '@prisma/client';

import { PERMISSIONS_KEY, SYSTEM_ROLES_KEY } from '../constants';

/**
 * Restricts a route to a platform-level role kind.
 *
 * Only for actions that are structurally not a school's to perform — creating
 * schools, appointing their administrators. Everything a school does to its own
 * data is gated with `@RequirePermissions` instead, because school roles are
 * authored at runtime and carry no names the code can rely on.
 */
export const RequireSystemRole = (...keys: SystemRoleKey[]) => SetMetadata(SYSTEM_ROLES_KEY, keys);

/**
 * Fine gate — the user must hold every listed permission (`resource:action`).
 * A `resource:manage` grant satisfies any action on that resource.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
