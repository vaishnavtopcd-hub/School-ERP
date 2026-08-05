import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { type Observable, tap } from 'rxjs';

/**
 * Per-request timing log. nestjs-pino already logs the request line; this adds
 * handler-level duration, which is what you want when profiling a slow module.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = http.getResponse<Response>();
          this.logger.log(`${method} ${originalUrl} ${statusCode} +${Date.now() - startedAt}ms`);
        },
        error: (error: Error) => {
          this.logger.warn(
            `${method} ${originalUrl} FAILED +${Date.now() - startedAt}ms — ${error.message}`,
          );
        },
      }),
    );
  }
}
