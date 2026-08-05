import { type SystemRoleKey } from '@prisma/client';
import { type Request } from 'express';

/**
 * Shape attached to `request.user` once the JWT strategy has validated a token.
 *
 * `roleNames` is free text authored by a school administrator, so it is for
 * display only — never branch on it. Authorization uses `systemKeys` (which
 * role *kind* this is) and `permissions`.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  /** NULL for the platform operator, who belongs to no school. */
  schoolId: string | null;
  roleNames: string[];
  systemKeys: SystemRoleKey[];
  permissions: string[];
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

/** Claims embedded in the access token. */
export interface JwtPayload {
  /** Subject — the user id. */
  sub: string;
  email: string;
  schoolId: string | null;
  iat?: number;
  exp?: number;
}
