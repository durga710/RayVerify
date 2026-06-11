import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
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
    return this.$extends({
      query: {
        // Arrow fn captures lexical `this` (the PrismaService instance).
        $allOperations: async ({ args, query }) => {
          const orgId = TenantContext.orgId();
          if (!orgId) return query(args);
          // Batch transaction pins BOTH statements to one connection, so the
          // transaction-scoped GUC from set_config(..., true) applies to the
          // wrapped operation and resets on commit. An interactive
          // $transaction(cb) must NOT be used here: query(args) inside the
          // callback executes outside the tx connection (Prisma limitation).
          // This mirrors Prisma's documented row-level-security pattern.
          const [, result] = await this.$transaction([
            this.$executeRaw`SELECT set_config('app.current_org', ${orgId}, true)`,
            query(args) as unknown as Prisma.PrismaPromise<unknown>,
          ]);
          return result;
        },
      },
    });
  }
}
