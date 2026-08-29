import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator.js';

/**
 * Standard API response envelope.
 */
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * Global interceptor that wraps all successful responses in a consistent
 * JSON envelope matching the format: { success: true, statusCode, message, data }.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();
    const statusCode = response.statusCode;

    // Read custom message defined via @ResponseMessage()
    const customMessage = this.reflector.get<string>(
      RESPONSE_MESSAGE_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data: T) => {
        let message = customMessage || 'Operation successful';
        let resultData = data;

        // If the handler returned an object with custom message and data properties
        if (
          data &&
          typeof data === 'object' &&
          'message' in (data as Record<string, unknown>) &&
          'data' in (data as Record<string, unknown>)
        ) {
          const payload = data as Record<string, unknown>;
          message = (payload.message as string) || message;
          resultData = payload.data as T;
        }

        return {
          success: true,
          statusCode,
          message,
          data: (resultData !== undefined ? resultData : null) as T,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
