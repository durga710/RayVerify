import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../context/tenant-context';

/**
 * Tenant-aware Prisma client.
 *
 * Hard multi-tenant isolation is enforced at the database via Row-Level
 * Security (see db/schema.sql). The application runtime connects with a role
 * that does NOT have BYPASSRLS, so any query missing the tenant GUC returns
 * zero rows — defense in depth against a forgotten `where: { organizationId }`.
 *
 * The `$extends` query wrapper opens a transaction per operation and sets
 * `app.current_org` with SET LOCAL (scoped to that transaction), reading the
 * tenant from the AsyncLocalStorage request context.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected (RLS-enforced runtime role)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Returns a client whose every query is bound to the current tenant via RLS.
   * Falls back to the base client when no tenant context is present (e.g.
   * health checks, auth bootstrap before login resolves an org).
   */
  forRequest() {
    const self = this;
    return this.$extends({
      query: {
        async $allOperations({ args, query }) {
          const orgId = TenantContext.orgId();
          if (!orgId) return query(args);
          // SET LOCAL keeps the GUC scoped to this transaction only, so the
          // RLS policy (organization_id = current_setting('app.current_org'))
          // applies to the wrapped operation and never leaks across requests.
          return self.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              `SET LOCAL "app.current_org" = '${orgId.replace(/'/g, "''")}'`,
            );
            return query(args);
          });
        },
      },
    });
  }
}
