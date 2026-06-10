import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant-context';

export interface AuditRecordInput {
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an immutable audit row. The prev_hash/hash chain is computed by the
   * DB trigger (rv_audit_hash_chain) so it cannot be forged from the app layer.
   */
  async record(input: AuditRecordInput) {
    const ctx = TenantContext.get();
    if (!ctx?.organizationId) return; // nothing to attribute (e.g. pre-auth)
    const db = this.prisma.forRequest();
    await db.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        actorId: ctx.userId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async search(params: {
    resourceType?: string;
    resourceId?: string;
    action?: AuditAction;
    skip: number;
    take: number;
  }) {
    const db = this.prisma.forRequest();
    const where: Prisma.AuditLogWhereInput = {
      ...(params.resourceType ? { resourceType: params.resourceType } : {}),
      ...(params.resourceId ? { resourceId: params.resourceId } : {}),
      ...(params.action ? { action: params.action } : {}),
    };
    const [data, total] = await Promise.all([
      db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
      db.auditLog.count({ where }),
    ]);
    return { data, total };
  }

  /**
   * Verifies the tamper-evident chain for the tenant: each row's prev_hash must
   * equal the previous row's hash. A break indicates deletion, reordering, or
   * tampering. (Full re-hash verification additionally re-derives each hash from
   * the canonical row; that runs in the offline compliance job to match Postgres
   * value serialization exactly.)
   */
  async verifyChain(): Promise<{ valid: boolean; checked: number; brokenAtId?: string }> {
    const db = this.prisma.forRequest();
    const rows = await db.auditLog.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, prevHash: true, hash: true },
    });
    let prev: string | null = null;
    for (const row of rows) {
      if ((row.prevHash ?? null) !== prev) {
        return { valid: false, checked: rows.length, brokenAtId: row.id };
      }
      prev = row.hash ?? null;
    }
    return { valid: true, checked: rows.length };
  }
}
