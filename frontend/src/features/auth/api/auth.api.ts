import { apiRequest, requestTokenRefresh, tokenStorage } from '@/shared/api';
import type { AuthSession, AuthUser } from '@/shared/types';

import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from '../schemas/auth.schemas';

interface MessageResponse {
  message: string;
}

/**
 * Thin transport layer for the auth endpoints. No React, no state — so it can
 * be reused from thunks, React Query mutations, or tests alike.
 */
export const authApi = {
  /** Sets the refresh cookie server-side; the access token comes back in the body. */
  async login(input: LoginInput): Promise<AuthSession> {
    const session = await apiRequest<AuthSession>({
      method: 'POST',
      url: '/auth/login',
      data: input,
    });
    tokenStorage.set(session.accessToken, session.expiresIn);
    return session;
  },

  /**
   * Exchanges the refresh cookie for a new access token. Used both by the 401
   * interceptor and on app start to restore a session across page reloads.
   */
  async refresh(): Promise<string> {
    return requestTokenRefresh();
  },

  async me(): Promise<AuthUser> {
    return apiRequest<AuthUser>({ method: 'GET', url: '/auth/me' });
  },

  /** Clears the cookie server-side. The local token is dropped either way. */
  async logout(): Promise<void> {
    try {
      await apiRequest<MessageResponse>({ method: 'POST', url: '/auth/logout' });
    } finally {
      tokenStorage.clear();
    }
  },

  async logoutAll(): Promise<void> {
    try {
      await apiRequest<MessageResponse>({ method: 'POST', url: '/auth/logout-all' });
    } finally {
      tokenStorage.clear();
    }
  },

  async forgotPassword(input: ForgotPasswordInput): Promise<MessageResponse> {
    return apiRequest<MessageResponse>({
      method: 'POST',
      url: '/auth/forgot-password',
      data: input,
    });
  },

  async resetPassword(input: ResetPasswordInput): Promise<MessageResponse> {
    const result = await apiRequest<MessageResponse>({
      method: 'POST',
      url: '/auth/reset-password',
      data: { token: input.token, newPassword: input.newPassword },
    });
    // The server revoked every session, so the in-memory token is now dead.
    tokenStorage.clear();
    return result;
  },

  async changePassword(input: ChangePasswordInput): Promise<MessageResponse> {
    const result = await apiRequest<MessageResponse>({
      method: 'PATCH',
      url: '/auth/change-password',
      data: { currentPassword: input.currentPassword, newPassword: input.newPassword },
    });
    tokenStorage.clear();
    return result;
  },
};
