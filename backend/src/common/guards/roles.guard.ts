import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRoleKey } from '@prisma/client';

import { PERMISSIONS_KEY, SYSTEM_ROLES_KEY, parsePermission } from '../constants';
import { type RequestWithUser } from '../types';

/**
 * Authorization gate. Runs after JwtAuthGuard, so `request.user` is populated.
 *
 * Resolution order:
 *   1. No `@RequireSystemRole`/`@RequirePermissions` metadata -> allow.
 *   2. SUPER_ADMIN                                            -> allow.
 *   3. `@RequireSystemRole(...)`  -> user needs ANY listed system role.
 *   4. `@RequirePermissions(...)` -> user needs ALL listed keys, where a
 *      `resource:manage` grant satisfies any action on that resource.
 *
 * SCHOOL_ADMIN is deliberately *not* a blanket bypass. It holds every
 * school-grantable permission, so it passes step 4 on its own merits — but the
 * services still scope every query to `actor.schoolId`, which is what keeps one
 * school's administrator out of another school's data. A bypass here would
 * skip that reasoning entirely.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const requiredSystemRoles = this.reflector.getAllAndOverride<SystemRoleKey[]>(
      SYSTEM_ROLES_KEY,
      targets,
    );
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      targets,
    );

    const hasRoleRule = Boolean(requiredSystemRoles?.length);
    const hasPermissionRule = Boolean(requiredPermissions?.length);

    if (!hasRoleRule && !hasPermissionRule) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    if (!user) {
      throw new ForbiddenException('Authentication required for this resource');
    }

    // The platform operator is outside the tenant model entirely.
    if (user.systemKeys?.includes(SystemRoleKey.SUPER_ADMIN)) {
      return true;
    }

    if (hasRoleRule && !requiredSystemRoles.some((key) => user.systemKeys?.includes(key))) {
      throw new ForbiddenException('This action is restricted to the platform operator');
    }

    if (hasPermissionRule) {
      const missing = requiredPermissions.filter(
        (permission) => !this.hasPermission(user.permissions ?? [], permission),
      );

      if (missing.length > 0) {
        throw new ForbiddenException(`Missing permission(s): ${missing.join(', ')}`);
      }
    }

    return true;
  }

  private hasPermission(granted: string[], required: string): boolean {
    if (granted.includes(required)) {
      return true;
    }
    const { resource } = parsePermission(required);
    return granted.includes(`${resource}:manage`);
  }
}
