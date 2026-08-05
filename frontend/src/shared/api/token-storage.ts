/**
 * Access-token storage.
 *
 * The token lives in a module variable — NOT in localStorage or sessionStorage.
 * Anything in web storage is readable by any script on the origin, so a single
 * XSS bug leaks the session; a module variable dies with the tab and never
 * touches disk.
 *
 * The refresh token is not here at all: it is an httpOnly, SameSite=strict
 * cookie that only the browser can see, scoped to `/api/v1/auth`. Surviving a
 * page reload is therefore the refresh endpoint's job, not storage's — see
 * `restoreSession` in features/auth.
 */
let accessToken: string | null = null;
let expiresAt: number | null = null;

export const tokenStorage = {
  get(): string | null {
    return accessToken;
  },

  set(token: string, expiresInSeconds: number): void {
    accessToken = token;
    expiresAt = Date.now() + expiresInSeconds * 1000;
  },

  clear(): void {
    accessToken = null;
    expiresAt = null;
  },

  hasToken(): boolean {
    return accessToken !== null;
  },

  /**
   * True once the token is within `skewSeconds` of expiry. Lets callers refresh
   * proactively instead of waiting for a 401 round-trip.
   */
  isExpiring(skewSeconds = 60): boolean {
    if (expiresAt === null) return true;
    return Date.now() >= expiresAt - skewSeconds * 1000;
  },
};
