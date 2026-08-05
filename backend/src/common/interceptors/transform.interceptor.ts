import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Request } from 'express';
import { type Observable, map } from 'rxjs';

import { REQUEST_ID_HEADER } from '../constants';
import { type ApiResponse } from '../types';

/**
 * Wraps every successful payload in a stable envelope so clients parse one
 * shape. Errors are shaped by AllExceptionsFilter instead.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.headers[REQUEST_ID_HEADER] as string | undefined,
      })),
    );
  }
}
