import { apiRequest } from '@/shared/api';
import type { AuthUser, ThemePreference } from '@/shared/types';

import type { ProfileInput } from '../schemas/profile.schemas';

/**
 * Everything a user may change about their own account. Fields left out are
 * untouched by the API; an explicit `null` clears one.
 */
export interface UpdateProfilePayload extends Partial<ProfileInput> {
  /** Data URL, or `null` to remove the picture. */
  avatarUrl?: string | null;
  /** `null` follows the operating system. */
  themePreference?: ThemePreference | null;
}

export const profileApi = {
  /** Returns the full refreshed session user, so callers can update state from it. */
  async update(payload: UpdateProfilePayload): Promise<AuthUser> {
    return apiRequest<AuthUser>({ method: 'PATCH', url: '/auth/me', data: payload });
  },
};
