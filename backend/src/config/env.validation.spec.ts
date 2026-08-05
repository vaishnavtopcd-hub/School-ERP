import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
    JWT_ACCESS_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: 'b'.repeat(48),
  };

  it('applies documented defaults when optional values are absent', () => {
    const env = validateEnv(validEnv);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.API_PREFIX).toBe('api');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('coerces numeric strings, since every env var arrives as a string', () => {
    const env = validateEnv({ ...validEnv, PORT: '8080', THROTTLE_LIMIT: '250' });
    expect(env.PORT).toBe(8080);
    expect(env.THROTTLE_LIMIT).toBe(250);
  });

  it('parses boolean-ish strings into real booleans', () => {
    const env = validateEnv({ ...validEnv, SWAGGER_ENABLED: 'false', LOG_PRETTY: 'true' });
    expect(env.SWAGGER_ENABLED).toBe(false);
    expect(env.LOG_PRETTY).toBe(true);
  });

  it('rejects a missing database url', () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = validEnv;
    expect(() => validateEnv(withoutDb)).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-postgres database url', () => {
    expect(() => validateEnv({ ...validEnv, DATABASE_URL: 'mysql://user@localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a JWT secret that is too short to be safe', () => {
    expect(() => validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /at least 32 characters/,
    );
  });

  it('rejects an unknown NODE_ENV rather than silently defaulting', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'prod' })).toThrow(/NODE_ENV/);
  });

  it('refuses to boot production with the placeholder secrets from .env.example', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'replace_with_a_long_random_string_at_least_32_chars',
      }),
    ).toThrow(/placeholder JWT secrets/);
  });

  it('refuses to boot production when both JWT secrets are identical', () => {
    const shared = 'c'.repeat(48);
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: shared,
        JWT_REFRESH_SECRET: shared,
      }),
    ).toThrow(/must differ/);
  });

  it('allows those same weak settings outside production', () => {
    const shared = 'd'.repeat(48);
    expect(() =>
      validateEnv({ ...validEnv, JWT_ACCESS_SECRET: shared, JWT_REFRESH_SECRET: shared }),
    ).not.toThrow();
  });
});
