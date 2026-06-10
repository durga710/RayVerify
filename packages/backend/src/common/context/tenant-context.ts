import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request execution context. Carries the resolved tenant (organizationId)
 * and actor so that:
 *   1. PrismaService can scope every query with Postgres RLS (`app.current_org`).
 *   2. The audit interceptor can attribute actions without threading params.
 *
 * Backed by AsyncLocalStorage so it survives async/await boundaries within a
 * single request without leaking across concurrent requests.
 */
export interface RequestContext {
  organizationId: string;
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const TenantContext = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },

  get(): RequestContext | undefined {
    return storage.getStore();
  },

  /** Throws if no tenant is bound — use where a tenant is mandatory. */
  require(): RequestContext {
    const ctx = storage.getStore();
    if (!ctx?.organizationId) {
      throw new Error('No tenant context bound to the current request');
    }
    return ctx;
  },

  orgId(): string | undefined {
    return storage.getStore()?.organizationId;
  },
};
