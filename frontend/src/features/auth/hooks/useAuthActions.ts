import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { useAppDispatch } from '@/app/store/hooks';
import { SESSION_EXPIRED_EVENT, queryClient } from '@/shared/api';

import { authApi } from '../api/auth.api';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from '../schemas/auth.schemas';
import { sessionEnded, sessionEstablished, initializationFinished } from '../store/auth.slice';

/** Sign in and populate the session. */
export function useLogin() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (session) => {
      dispatch(sessionEstablished(session.user));
    },
  });
}

/** Sign out. Local state is cleared even if the server call fails. */
export function useLogout() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: (allDevices?: boolean) => (allDevices ? authApi.logoutAll() : authApi.logout()),
    onSettled: () => {
      dispatch(sessionEnded());
      // Drop every cached query — the next user must not see the last one's data.
      queryClient.clear();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) => authApi.forgotPassword(input),
  });
}

/** Resetting revokes all sessions server-side, so the local one is dropped too. */
export function useResetPassword() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: (input: ResetPasswordInput) => authApi.resetPassword(input),
    onSuccess: () => {
      dispatch(sessionEnded());
      queryClient.clear();
    },
  });
}

export function useChangePassword() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: (input: ChangePasswordInput) => authApi.changePassword(input),
    onSuccess: () => {
      dispatch(sessionEnded());
      queryClient.clear();
    },
  });
}

/**
 * Restores the session on app start.
 *
 * The access token lives in memory, so a page reload loses it. The httpOnly
 * refresh cookie survives, so we silently exchange it for a new access token
 * and re-fetch the profile. A 401 here just means "not signed in" and is not an
 * error worth surfacing.
 *
 * Also listens for the interceptor's session-expired event so a mid-session
 * refresh failure clears state exactly once, in one place.
 */
export function useSessionRestore() {
  const dispatch = useAppDispatch();

  const restore = useCallback(async () => {
    try {
      await authApi.refresh();
      const user = await authApi.me();
      dispatch(sessionEstablished(user));
    } catch {
      dispatch(initializationFinished());
    }
  }, [dispatch]);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    const onExpired = () => {
      dispatch(sessionEnded());
      queryClient.clear();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [dispatch]);
}
