import { Injectable } from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant-context';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Emits a notification (used by the fraud pipeline for HIGH/CRITICAL alerts). */
  async emit(input: {
    userId?: string;
    title: string;
    body?: string;
    channel?: NotificationChannel;
    data?: Record<string, unknown>;
  }) {
    const ctx = TenantContext.require();
    const db = this.prisma.forRequest();
    return db.notification.create({
      data: {
        organizationId: ctx.organizationId,
        userId: input.userId,
        channel: input.channel ?? NotificationChannel.IN_APP,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async listForCurrentUser(params: { skip: number; take: number }) {
    const ctx = TenantContext.require();
    const db = this.prisma.forRequest();
    const where: Prisma.NotificationWhereInput = { userId: ctx.userId };
    const [data, total] = await Promise.all([
      db.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
      db.notification.count({ where }),
    ]);
    return { data, total };
  }

  async markRead(id: string) {
    const db = this.prisma.forRequest();
    return db.notification.update({ where: { id }, data: { status: 'READ', readAt: new Date() } });
  }
}
