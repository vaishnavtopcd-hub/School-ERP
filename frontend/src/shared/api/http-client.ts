import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/config/env';
import type { ApiErrorResponse, ApiResponse, RefreshResult } from '@/shared/types';

import { tokenStorage } from './token-storage';

/** Fired when the session cannot be recovered; the router listens and redirects. */
export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

/**
 * Normalised error every caller can rely on, regardless of whether the failure
 * came from the API, the network, or a cancelled request.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly details?: string[],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isValidationError(): boolean {
    return this.statusCode === 400 || this.statusCode === 422;
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  /** Field-level messages from the global ValidationPipe, ready to display. */
  get fieldMessages(): string[] {
    return this.details ?? [];
  }
}

export const httpClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
  // Required for the httpOnly refresh cookie to travel with /auth requests.
  withCredentials: true,
});

/** Endpoints that must never trigger the refresh-and-retry path. */
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

// --- Request: attach the in-memory access token ------------------------------
httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Response: refresh once on 401, then retry -------------------------------

/**
 * A single in-flight refresh shared by every request that 401s while it runs,
 * so a burst of parallel calls triggers one rotation rather than N. That matters
 * here specifically: refresh tokens rotate server-side, and concurrent refreshes
 * would each spend the cookie, tripping the reuse detector and killing the
 * session.
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // A bare axios call — going through httpClient would re-enter this
  // interceptor if the refresh itself 401s.
  const { data } = await axios.post<ApiResponse<RefreshResult>>(
    `${env.apiBaseUrl}/auth/refresh`,
    {},
    { withCredentials: true, headers: { 'Content-Type': 'application/json' } },
  );

  tokenStorage.set(data.data.accessToken, data.data.expiresIn);
  return data.data.accessToken;
}

/** Exposed so the app can restore a session on load without a failed call first. */
export async function requestTokenRefresh(): Promise<string> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => original?.url?.includes(path));

    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        const token = await requestTokenRefresh();
        original.headers.Authorization = `Bearer ${token}`;
        return await httpClient(original);
      } catch {
        tokenStorage.clear();
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    }

    const body = error.response?.data;

    throw new ApiError(
      body?.message ?? error.message ?? 'An unexpected error occurred',
      body?.statusCode ?? error.response?.status ?? 0,
      body?.error ?? error.code ?? 'NetworkError',
      body?.details,
      body?.requestId,
    );
  },
);

/** Unwraps `ApiResponse<T>` so callers work with `T` directly. */
export async function apiRequest<T>(config: Parameters<AxiosInstance['request']>[0]): Promise<T> {
  const response = await httpClient.request<ApiResponse<T>>(config);
  return response.data.data;
}
