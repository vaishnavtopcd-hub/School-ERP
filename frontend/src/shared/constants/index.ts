export * from './routes';

/**
 * localStorage keys — namespaced to avoid collisions with other apps on the host.
 *
 * Note there is deliberately no token key here: the access token is held in
 * memory and the refresh token in an httpOnly cookie. Nothing about the session
 * is written to web storage.
 */
export const STORAGE_KEYS = {
  themeMode: 'school-erp:theme-mode',
} as const;

export const QUERY_KEYS = {
  currentUser: ['auth', 'me'] as const,
} as const;
