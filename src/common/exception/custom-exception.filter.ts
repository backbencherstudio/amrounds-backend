import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from 'prisma/generated/client';

@Catch()
export class CustomExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    // Default to Internal Server Error
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const msg = (exceptionResponse as any).message;
        message = Array.isArray(msg) ? msg.join(', ') : msg;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle known Prisma errors
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        // P2002: Unique constraint failed
        const target = exception.meta?.target;
        if (Array.isArray(target)) {
          message = `Unique constraint violation: ${target.join(', ')} already exists`;
        } else {
          message = `Unique constraint violation: Record already exists`;
        }
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
      } else {
        // Other Prisma errors
        if (process.env.NODE_ENV === 'development') {
          message = exception.message.replace(/\n/g, '');
        }
      }
    } else {
      // Handle other non-HttpExceptions
      if (process.env.NODE_ENV === 'development') {
        if (exception instanceof Error) {
          message = exception.message;
        } else {
          message = String(exception);
        }
      }
    }

    // Format response
    response.status(status).json({
      success: false,
      message: message,
    });
  }
}
