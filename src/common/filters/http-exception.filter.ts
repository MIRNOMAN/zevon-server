import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Global centralized exception filter.
 * Catches HttpExceptions, Prisma database exceptions, and unexpected errors,
 * standardizing all error responses into a consistent JSON payload.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] | object = 'Internal server error';
    let errorType: string | undefined;

    // 1. NestJS Standard HttpExceptions (including ValidationPipe errors)
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const responseObj = res as Record<string, unknown>;
        message =
          (responseObj['message'] as string | string[] | object) ||
          exception.message;
        errorType = (responseObj['error'] as string) || undefined;
      }
    }
    // 2. Prisma Known Request Errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          const target = Array.isArray(exception.meta?.target)
            ? exception.meta.target.join(', ')
            : typeof exception.meta?.target === 'string'
              ? exception.meta.target
              : 'unknown';
          message = `Unique constraint failed on field(s): ${target}`;
          errorType = 'Conflict';
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          message =
            typeof exception.meta?.cause === 'string'
              ? exception.meta.cause
              : 'Record not found';
          errorType = 'Not Found';
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          const fieldName =
            typeof exception.meta?.field_name === 'string'
              ? exception.meta.field_name
              : 'relation';
          message = `Foreign key constraint failed on field: ${fieldName}`;
          errorType = 'Bad Request';
          break;
        }
        default: {
          status = HttpStatus.BAD_REQUEST;
          message = `Database operation error: [${exception.code}]`;
          errorType = 'Database Error';
          break;
        }
      }
    }
    // 3. Prisma Validation Errors
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided for database operation';
      errorType = 'Prisma Validation Error';
    }
    // 4. Standard JavaScript / Unknown Errors
    else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorResponse = {
      success: false,
      statusCode: status,
      message,
      ...(errorType ? { error: errorType } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    // Log 5xx errors at error level with stack trace, 4xx at warn level
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} ${status} - Error: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} ${status} - Warning: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
