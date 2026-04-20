import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Sunucu hatası oluştu';
    let errors: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exceptionResponse.message || message;
      errors =
        typeof exceptionResponse === 'object' ? exceptionResponse.errors : null;
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
      // DB hataları
      if ((exception as any).code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'Bu kayıt zaten mevcut';
      } else if ((exception as any).code === '23503') {
        status = HttpStatus.BAD_REQUEST;
        message = 'İlişkili kayıt bulunamadı';
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message.join(', ') : message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
