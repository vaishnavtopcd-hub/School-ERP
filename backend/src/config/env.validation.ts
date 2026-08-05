import { z } from 'zod';

/**
 * Single source of truth for every environment variable the API reads.
 * Validation runs once at boot — a missing or malformed value fails fast with
 * a readable message instead of surfacing as `undefined` deep in a request.
 */
const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z.string().default('1'),

  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql://'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Auth policy
  /** Minutes a password-reset link stays valid. */
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  /** Consecutive failed logins before the account is temporarily locked. */
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  /** Minutes an account stays locked after hitting the limit. */
  ACCOUNT_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  /** Public URL of the SPA — used to build password-reset links. */
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),

  // Refresh-token cookie
  REFRESH_COOKIE_NAME: z.string().default('school_erp_rt'),
  /** Must be true anywhere the app is served over HTTPS. */
  COOKIE_SECURE: booleanFromString.default('false'),
  COOKIE_DOMAIN: z.string().optional(),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: booleanFromString.default('true'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: booleanFromString.default('false'),

  // Swagger
  SWAGGER_ENABLED: booleanFromString.default('true'),
  SWAGGER_PATH: z.string().default('docs'),

  // Rate limiting
  THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Passed to `ConfigModule.forRoot({ validate })`.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  // Refuse to boot production with the placeholder secrets from .env.example.
  if (parsed.data.NODE_ENV === 'production') {
    const placeholders = [parsed.data.JWT_ACCESS_SECRET, parsed.data.JWT_REFRESH_SECRET];
    if (placeholders.some((secret) => secret.startsWith('replace_with'))) {
      throw new Error('Refusing to start in production with placeholder JWT secrets.');
    }
    if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ.');
    }
    // The refresh cookie is the whole session; without Secure it can leak over
    // plain HTTP, so refuse rather than silently downgrade.
    if (!parsed.data.COOKIE_SECURE) {
      throw new Error('COOKIE_SECURE must be true in production.');
    }
  }

  return parsed.data;
}
