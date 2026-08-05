import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { REQUEST_ID_HEADER } from '@/common/constants';
import { type AppConfig } from '@/config';

/**
 * Structured logging.
 *
 * - JSON in production (ready for Loki/CloudWatch/Datadog), pretty locally.
 * - Every line carries the `x-request-id` correlation id.
 * - Credentials and tokens are redacted before they reach a transport.
 */
@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { level, pretty } = config.get('logger', { infer: true });

        return {
          pinoHttp: {
            level,
            genReqId: (req: IncomingMessage) => req.headers[REQUEST_ID_HEADER] as string,
            customProps: (req: IncomingMessage) => ({
              requestId: req.headers[REQUEST_ID_HEADER],
            }),
            autoLogging: {
              // Health checks and doc assets would drown out real traffic.
              ignore: (req: IncomingMessage) =>
                Boolean(req.url?.includes('/health')) || Boolean(req.url?.includes('/docs')),
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.currentPassword',
                'req.body.newPassword',
                'req.body.refreshToken',
                'res.headers["set-cookie"]',
                '*.passwordHash',
                '*.accessToken',
                '*.refreshToken',
              ],
              censor: '[REDACTED]',
            },
            serializers: {
              req: (req: IncomingMessage & { id: string; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
            },
            customLogLevel: (_req, res: ServerResponse, err?: Error) => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            transport: pretty
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
