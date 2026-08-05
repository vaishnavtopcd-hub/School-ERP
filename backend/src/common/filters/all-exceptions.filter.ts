import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { type Request } from 'express';

import { REQUEST_ID_HEADER } from '../constants';

export interface ErrorResponseBody {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  /** Field-level messages produced by the global ValidationPipe. */
  details?: unknown;
  timestamp: string;
  path: string;
  requestId?: string;
}

/**
 * Last line of defence: every unhandled error leaves the API in one shape.
 * Internal details (stack traces, Prisma internals) are logged, never returned.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error, details } = this.normalize(exception);

    const body: ErrorResponseBody = {
      success: false,
      statusCode,
      message,
      error,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(request) as string,
      requestId: request.headers[REQUEST_ID_HEADER] as string | undefined,
    };

    if (statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `${request.method} ${body.path} -> ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${body.path} -> ${statusCode}: ${message}`);
    }

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }

  private normalize(exception: unknown): {
    statusCode: number;
    message: string;
    error: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { statusCode: status, message: response, error: exception.name };
      }

      const payload = response as { message?: string | string[]; error?: string };
      const raw = payload.message;
      const isFieldErrors = Array.isArray(raw);

      return {
        statusCode: status,
        message: isFieldErrors ? 'Validation failed' : (raw ?? exception.message),
        error: payload.error ?? exception.name,
        details: isFieldErrors ? raw : undefined,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data supplied to the database query',
        error: 'PrismaValidationError',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
    };
  }

  /** Maps the Prisma error codes worth distinguishing to HTTP semantics. */
  private fromPrisma(exception: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
    error: string;
    details?: unknown;
  } {
    const target = (exception.meta?.target as string[] | string | undefined) ?? undefined;
    const fields = Array.isArray(target) ? target.join(', ') : target;

    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: fields
            ? `A record with this ${fields} already exists`
            : 'A record with these values already exists',
          error: 'UniqueConstraintViolation',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Related record does not exist',
          error: 'ForeignKeyConstraintViolation',
        };
      case 'P2011':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: `Required field is missing: ${fields ?? 'unknown'}`,
          error: 'NullConstraintViolation',
        };
      case 'P2014':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'The change would violate a required relation',
          error: 'RelationViolation',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'The requested record was not found',
          error: 'RecordNotFound',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred',
          error: 'DatabaseError',
        };
    }
  }
}
