import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  Optional,
  RequestTimeoutException,
} from '@nestjs/common';
import { type Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs';

/** DI token for the timeout budget — see AppModule's APP_INTERCEPTOR factory. */
export const REQUEST_TIMEOUT_MS = 'REQUEST_TIMEOUT_MS';

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Caps how long a single request may occupy a worker. */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(@Optional() @Inject(REQUEST_TIMEOUT_MS) timeoutMs?: number) {
    this.timeoutMs = timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new RequestTimeoutException('The request took too long to complete')
            : error,
        ),
      ),
    );
  }
}
