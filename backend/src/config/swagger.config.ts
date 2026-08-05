import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

interface SwaggerOptions {
  path: string;
  apiPrefix: string;
  version: string;
}

/**
 * Mounts OpenAPI docs at `/<apiPrefix>/<path>` (e.g. `/api/docs`) and exposes
 * the raw spec at `/<apiPrefix>/<path>-json` for client generation.
 *
 * Feature modules only need `@ApiTags()` on their controllers — new tags show
 * up automatically, so this never needs editing as modules are added.
 */
export function setupSwagger(app: INestApplication, options: SwaggerOptions): void {
  const config = new DocumentBuilder()
    .setTitle('School ERP API')
    .setDescription(
      'REST API for the School ERP platform.\n\n' +
        'Authenticate via `POST /auth/login`, then click **Authorize** and paste the access token.',
    )
    .setVersion(options.version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
        description: 'Access token returned by the login endpoint.',
      },
      'access-token',
    )
    .addTag('Health', 'Liveness and readiness probes')
    .addTag('Auth', 'Authentication and session management')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });

  SwaggerModule.setup(`${options.apiPrefix}/${options.path}`, app, document, {
    jsonDocumentUrl: `${options.apiPrefix}/${options.path}-json`,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
    customSiteTitle: 'School ERP API Docs',
  });
}
