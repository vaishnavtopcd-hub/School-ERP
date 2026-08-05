/**
 * The two role kinds the platform itself depends on. Mirrors the backend's
 * `SystemRoleKey` enum.
 *
 * Every other role is authored at runtime by a school administrator and has a
 * free-text name, so there is deliberately no list of role names here — a
 * hardcoded one would go stale the moment a school renamed or added a role.
 */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SCHOOL_ADMIN: 'SCHOOL_ADMIN',
} as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const SYSTEM_ROLE_LABELS: Record<SystemRoleKey, string> = {
  SUPER_ADMIN: 'Platform operator',
  SCHOOL_ADMIN: 'School administrator',
};

/** A role as held by a user. `name` is display-only — branch on `systemKey`. */
export interface UserRole {
  id: string;
  name: string;
  systemKey: SystemRoleKey | null;
}

/** `resource:action`, e.g. `student:create`. */
export type Permission = string;

/** Colour mode a user has pinned. `null` means follow the operating system. */
export type ThemePreference = 'LIGHT' | 'DARK';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** NULL for the platform operator, who belongs to no school. */
  schoolId: string | null;
  /** Display names of the roles held. Do not branch on these. */
  roles: string[];
  /** Platform-level role kinds held, if any. This is what may be branched on. */
  systemKeys: SystemRoleKey[];
  permissions: Permission[];

  // --- Profile -------------------------------------------------------------
  // Delivered with the session rather than from a separate endpoint, so the
  // avatar is available the moment the app paints.
  phone: string | null;
  /** Avatar as a `data:` URL — the API stores it inline, not as a file link. */
  avatarUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  themePreference: ThemePreference | null;
}

/**
 * Login/refresh response. The refresh token is deliberately absent — it lives
 * in an httpOnly cookie the browser manages and script cannot read.
 */
export interface AuthSession {
  accessToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  user: AuthUser;
}

export interface RefreshResult {
  accessToken: string;
  expiresIn: number;
}
