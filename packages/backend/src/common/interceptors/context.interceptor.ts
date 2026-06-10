import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { TenantContext } from '../context/tenant-context';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Binds the per-request TenantContext (organizationId + actor) for the lifetime
 * of the handler so PrismaService can apply RLS and the audit trail can attribute
 * actions. Runs after the auth guard, so req.user is populated.
 */
@Injectable()
export class ContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = req.user;
    const requestId =
      req.headers['x-request-id'] ?? randomUUID();
    req.requestId = requestId;

    if (!user?.organizationId) {
      return next.handle();
    }

    return TenantContext.run(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        requestId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
      () => next.handle(),
    );
  }
}
