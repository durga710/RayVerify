import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { TenantContext } from '../context/tenant-context';

/**
 * RFC 7807-style error envelope. Never leaks stack traces or PHI to clients;
 * logs full detail server-side with the request id for correlation.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException ? exception.getResponse() : null;

    const requestId = req.requestId ?? TenantContext.get()?.requestId;

    const body = {
      type: `https://docs.rayverify.gov/errors/${status}`,
      status,
      title:
        typeof payload === 'object' && payload && 'message' in payload
          ? (payload as { message: unknown }).message
          : HttpStatus[status] ?? 'Error',
      instance: req.url,
      requestId,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status} [req=${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${req.method} ${req.url} -> ${status} [req=${requestId}]`,
      );
    }

    res.status(status).json(body);
  }
}
