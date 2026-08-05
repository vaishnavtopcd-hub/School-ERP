import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, SESSION_EXPIRED_EVENT, httpClient } from './http-client';
import { tokenStorage } from './token-storage';

type Handler = (url: string, config: { headers: Record<string, string> }) => AxiosResponse | never;

interface FailureMarker {
  __fail: true;
  status: number;
  body?: unknown;
}

function ok(data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config: {} as never };
}

/**
 * Signals a non-2xx response. The adapter turns this into a real AxiosError —
 * crucially one carrying `config`, since the retry interceptor reads
 * `error.config` to replay the original request.
 */
function fail(status: number, body?: unknown): never {
  throw { __fail: true, status, body } satisfies FailureMarker;
}

const isFailure = (value: unknown): value is FailureMarker =>
  typeof value === 'object' && value !== null && '__fail' in value;

/** Installs a fake transport on both the app client and bare axios (refresh). */
function installAdapter(handler: Handler) {
  const adapter: AxiosAdapter = (config) =>
    Promise.resolve().then(() => {
      try {
        return handler(config.url ?? '', {
          headers: (config.headers ?? {}) as unknown as Record<string, string>,
        });
      } catch (thrown) {
        if (!isFailure(thrown)) throw thrown;
        const response: AxiosResponse = {
          data: thrown.body,
          status: thrown.status,
          statusText: '',
          headers: {},
          config,
        };
        throw new AxiosError('Request failed', String(thrown.status), config, undefined, response);
      }
    });

  httpClient.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
}

describe('httpClient interceptors', () => {
  beforeEach(() => {
    tokenStorage.clear();
  });

  afterEach(() => {
    httpClient.defaults.adapter = undefined;
    axios.defaults.adapter = undefined;
    vi.restoreAllMocks();
  });

  it('attaches the in-memory access token as a bearer header', async () => {
    tokenStorage.set('token-abc', 900);
    let seen: string | undefined;

    installAdapter((_url, config) => {
      seen = config.headers.Authorization;
      return ok({ success: true, data: { ok: true } });
    });

    await httpClient.get('/whatever');
    expect(seen).toBe('Bearer token-abc');
  });

  it('sends no Authorization header when there is no session', async () => {
    let seen: string | undefined = 'unset';

    installAdapter((_url, config) => {
      seen = config.headers.Authorization;
      return ok({ success: true, data: {} });
    });

    await httpClient.get('/whatever');
    expect(seen).toBeUndefined();
  });

  it('refreshes once on 401 and replays the request with the new token', async () => {
    tokenStorage.set('stale-token', 900);
    const authHeaders: (string | undefined)[] = [];
    let refreshCalls = 0;

    installAdapter((url, config) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return ok({ success: true, data: { accessToken: 'fresh-token', expiresIn: 900 } });
      }
      authHeaders.push(config.headers.Authorization);
      // First attempt carries the stale token and is rejected.
      if (authHeaders.length === 1) fail(401);
      return ok({ success: true, data: { ok: true } });
    });

    const response = await httpClient.get('/protected');

    expect(refreshCalls).toBe(1);
    expect(authHeaders).toEqual(['Bearer stale-token', 'Bearer fresh-token']);
    expect(response.data).toMatchObject({ success: true });
    expect(tokenStorage.get()).toBe('fresh-token');
  });

  it('coalesces concurrent 401s into a single refresh', async () => {
    // This is the important one: refresh tokens rotate server-side, so a second
    // concurrent refresh would spend an already-used token and trip the reuse
    // detector, killing the whole session.
    tokenStorage.set('stale-token', 900);
    let refreshCalls = 0;
    const rejectedOnce = new Set<string>();

    installAdapter((url) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return ok({ success: true, data: { accessToken: 'fresh-token', expiresIn: 900 } });
      }
      if (!rejectedOnce.has(url)) {
        rejectedOnce.add(url);
        fail(401);
      }
      return ok({ success: true, data: { url } });
    });

    await Promise.all([
      httpClient.get('/one'),
      httpClient.get('/two'),
      httpClient.get('/three'),
      httpClient.get('/four'),
    ]);

    expect(refreshCalls).toBe(1);
  });

  it('does not try to refresh when the login request itself fails', async () => {
    let refreshCalls = 0;

    installAdapter((url) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return ok({ success: true, data: { accessToken: 'x', expiresIn: 900 } });
      }
      fail(401, { success: false, statusCode: 401, message: 'Invalid email or password' });
    });

    await expect(httpClient.post('/auth/login', {})).rejects.toBeInstanceOf(ApiError);
    expect(refreshCalls).toBe(0);
  });

  it('clears the session and announces expiry when refresh fails', async () => {
    tokenStorage.set('stale-token', 900);
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    installAdapter((url) => {
      if (url.includes('/auth/refresh')) fail(401);
      fail(401);
    });

    await expect(httpClient.get('/protected')).rejects.toBeInstanceOf(ApiError);

    expect(tokenStorage.get()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);

    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });

  it('retries a request only once, so a persistent 401 cannot loop', async () => {
    tokenStorage.set('stale-token', 900);
    let protectedCalls = 0;

    installAdapter((url) => {
      if (url.includes('/auth/refresh')) {
        return ok({ success: true, data: { accessToken: 'fresh-token', expiresIn: 900 } });
      }
      protectedCalls += 1;
      fail(401);
    });

    await expect(httpClient.get('/protected')).rejects.toBeInstanceOf(ApiError);
    expect(protectedCalls).toBe(2);
  });

  it('normalises API error bodies into ApiError', async () => {
    installAdapter(() =>
      fail(400, {
        success: false,
        statusCode: 400,
        message: 'Validation failed',
        error: 'BadRequest',
        details: ['email must be an email'],
        requestId: 'req-1',
      }),
    );

    const error = await httpClient.post('/auth/login', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.statusCode).toBe(400);
    expect(apiError.message).toBe('Validation failed');
    expect(apiError.fieldMessages).toEqual(['email must be an email']);
    expect(apiError.requestId).toBe('req-1');
    expect(apiError.isValidationError).toBe(true);
  });

  it('surfaces rate limiting distinctly', async () => {
    installAdapter(() =>
      fail(429, { success: false, statusCode: 429, message: 'Too Many Requests' }),
    );

    const error = (await httpClient.post('/auth/login', {}).catch((e: unknown) => e)) as ApiError;

    expect(error.isRateLimited).toBe(true);
  });
});

describe('tokenStorage', () => {
  it('keeps the token out of web storage entirely', () => {
    tokenStorage.set('secret-token', 900);

    const dumped = JSON.stringify({ ...localStorage, ...sessionStorage });
    expect(dumped).not.toContain('secret-token');
  });

  it('reports expiry within the skew window', () => {
    tokenStorage.set('t', 30);
    expect(tokenStorage.isExpiring(60)).toBe(true);

    tokenStorage.set('t', 600);
    expect(tokenStorage.isExpiring(60)).toBe(false);
  });

  it('treats a missing token as expiring', () => {
    tokenStorage.clear();
    expect(tokenStorage.isExpiring()).toBe(true);
    expect(tokenStorage.hasToken()).toBe(false);
  });
});
