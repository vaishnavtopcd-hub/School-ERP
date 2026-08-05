import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { type AppConfig } from './config';
import { setupSwagger } from './config/swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Pino takes over once the app is up; buffer the boot logs until then.
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService<AppConfig, true>);
  const { port, apiPrefix, apiVersion, isProduction } = config.get('app', { infer: true });
  const cors = config.get('cors', { infer: true });
  const swagger = config.get('swagger', { infer: true });

  // --- Security ------------------------------------------------------------
  app.use(
    helmet({
      // The Swagger UI is served from this origin and needs inline styles.
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  // Required to read the httpOnly refresh cookie in AuthController.
  app.use(cookieParser());
  // Avatars are sent inline as data URLs (see `User.avatarUrl`), which the
  // 100kb body-parser default would reject with an opaque 413. Raised just far
  // enough to clear the DTO's own avatar cap, so the DTO stays the real limit.
  app.useBodyParser('json', { limit: '1mb' });
  // Behind nginx/a load balancer, so `request.ip` reflects X-Forwarded-For
  // rather than the proxy's address — rate limiting depends on this.
  app.set('trust proxy', 1);

  // --- CORS ----------------------------------------------------------------
  app.enableCors({
    origin: cors.origins.includes('*') ? true : cors.origins,
    credentials: cors.credentials,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86_400,
  });

  // --- Routing -------------------------------------------------------------
  // Routes resolve as /api/v1/<controller>. Health checks stay unversioned so
  // orchestrators keep working across API version bumps.
  app.setGlobalPrefix(apiPrefix, { exclude: ['health/live', 'health/ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: apiVersion });

  // --- API documentation ---------------------------------------------------
  if (swagger.enabled) {
    setupSwagger(app, { path: swagger.path, apiPrefix, version: apiVersion });
  }

  // --- Lifecycle -----------------------------------------------------------
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}/${apiPrefix}/v${apiVersion}`);
  if (swagger.enabled) {
    logger.log(`Swagger UI at http://localhost:${port}/${apiPrefix}/${swagger.path}`);
  }
}

void bootstrap();
