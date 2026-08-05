import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { useColorMode } from '@/app/theme/color-mode';
import { sessionEstablished } from '@/features/auth';

import { profileApi, type UpdateProfilePayload } from '../api/profile.api';

/**
 * Saves the signed-in user's own profile.
 *
 * The API answers with the refreshed session user, so the response is pushed
 * straight back into the auth slice — that is what makes a new avatar or name
 * appear in the top bar without a refetch.
 */
export function useUpdateProfile() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileApi.update(payload),
    onSuccess: (user) => {
      dispatch(sessionEstablished(user));
    },
  });
}

/**
 * Applies the colour mode saved on the account once the session is known.
 *
 * The provider has already painted from localStorage, which is what keeps the
 * first frame correct on a reload. This is what makes the choice follow the
 * user to a different browser, where there is no local value to read.
 *
 * Deliberately one-way: it does not clear a local pin when the account has
 * none, so toggling from the top bar still works for a user who has never
 * opened the settings page.
 */
export function useSyncThemePreference(): void {
  const preference = useAppSelector((state) => state.auth.user?.themePreference ?? null);
  const { setMode } = useColorMode();

  useEffect(() => {
    if (!preference) return;
    setMode(preference === 'DARK' ? 'dark' : 'light');
  }, [preference, setMode]);
}
