import { registerAs } from '@nestjs/config';

import { type Env } from './env.validation';

/**
 * Typed, namespaced views over the validated environment.
 * Inject with `ConfigService<AppConfig>` or `@Inject(appConfig.KEY)`.
 */
const env = () => process.env as unknown as Env;

export const appConfig = registerAs('app', () => ({
  nodeEnv: env().NODE_ENV,
  port: Number(env().PORT),
  apiPrefix: env().API_PREFIX,
  apiVersion: env().API_VERSION,
  isProduction: env().NODE_ENV === 'production',
  isDevelopment: env().NODE_ENV === 'development',
}));

export const databaseConfig = registerAs('database', () => ({
  url: env().DATABASE_URL,
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: env().JWT_ACCESS_SECRET,
  accessExpiresIn: env().JWT_ACCESS_EXPIRES_IN,
  refreshSecret: env().JWT_REFRESH_SECRET,
  refreshExpiresIn: env().JWT_REFRESH_EXPIRES_IN,
}));

export const authConfig = registerAs('auth', () => ({
  passwordResetTtlMinutes: Number(env().PASSWORD_RESET_TTL_MINUTES),
  maxFailedLoginAttempts: Number(env().MAX_FAILED_LOGIN_ATTEMPTS),
  accountLockMinutes: Number(env().ACCOUNT_LOCK_MINUTES),
  webAppUrl: env().WEB_APP_URL,
  refreshCookieName: env().REFRESH_COOKIE_NAME,
  cookieSecure: String(env().COOKIE_SECURE) === 'true',
  cookieDomain: env().COOKIE_DOMAIN,
}));

export const corsConfig = registerAs('cors', () => ({
  origins: env()
    .CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  credentials: String(env().CORS_CREDENTIALS) === 'true',
}));

export const loggerConfig = registerAs('logger', () => ({
  level: env().LOG_LEVEL,
  pretty: String(env().LOG_PRETTY) === 'true',
}));

export const swaggerConfig = registerAs('swagger', () => ({
  enabled: String(env().SWAGGER_ENABLED) === 'true',
  path: env().SWAGGER_PATH,
}));

export const throttleConfig = registerAs('throttle', () => ({
  ttl: Number(env().THROTTLE_TTL),
  limit: Number(env().THROTTLE_LIMIT),
}));

export const configurations = [
  appConfig,
  databaseConfig,
  jwtConfig,
  authConfig,
  corsConfig,
  loggerConfig,
  swaggerConfig,
  throttleConfig,
];

export type AppConfig = {
  app: ReturnType<typeof appConfig>;
  database: ReturnType<typeof databaseConfig>;
  jwt: ReturnType<typeof jwtConfig>;
  auth: ReturnType<typeof authConfig>;
  cors: ReturnType<typeof corsConfig>;
  logger: ReturnType<typeof loggerConfig>;
  swagger: ReturnType<typeof swaggerConfig>;
  throttle: ReturnType<typeof throttleConfig>;
};
