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
    const request = ctx.getRequest();

    const isDev = process.env.NODE_ENV === 'development';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] =
      'Something went wrong. Please try again later.';

    /* ===============================
       1️⃣ HTTP Exceptions
    =============================== */
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res && 'message' in res) {
        const msg = (res as any).message;
        message = Array.isArray(msg) ? msg.join(', ') : msg;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      /* ===============================
       2️⃣ Prisma Known Errors
    =============================== */
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'This record already exists.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Requested record was not found.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'Database operation failed.';
      }

      if (isDev) message = exception.message;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      /* ===============================
       3️⃣ Prisma Validation Errors
    =============================== */
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided.';

      if (isDev) message = exception.message;
    } else if (exception instanceof Error) {
      /* ===============================
       4️⃣ System / JS Errors
    =============================== */
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = isDev ? exception.message : 'Internal server error occurred.';
    }

    /* ===============================
       5️⃣ DEV Console Group Logging
    =============================== */
    if (isDev) {
      console.group(
        `%c🚨 API ERROR [${new Date().toISOString()}]`,
        'color:red;font-weight:bold;',
      );

      console.log('📍 Path:', request?.method, request?.url);
      console.log('📦 Status:', status);
      console.log('💬 Client Message:', message);

      if (exception instanceof Error) {
        console.log('🧠 Error Name:', exception.name);
        console.log('📄 Error Message:', exception.message);
        console.log('📚 Stack Trace ↓');
        console.error(exception.stack);
      } else {
        console.log('⚠️ Raw Exception:', exception);
      }

      console.groupEnd();
    }

    response.status(status).json({
      success: false,
      message,
    });
  }
}
