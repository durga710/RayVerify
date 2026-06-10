import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportFormat, ReportType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant-context';

export interface RequestReportInput {
  type: ReportType;
  format?: ReportFormat;
  parameters?: Record<string, unknown>;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Queues a report. A worker (BullMQ) renders it to PDF/XLSX, uploads to S3,
   * and flips status to READY with a presigned download. Here we persist the
   * request; generation is handled by the reporting worker.
   */
  async request(input: RequestReportInput) {
    const ctx = TenantContext.require();
    const db = this.prisma.forRequest();
    return db.report.create({
      data: {
        organizationId: ctx.organizationId,
        type: input.type,
        format: input.format ?? ReportFormat.PDF,
        parameters: (input.parameters ?? {}) as Prisma.InputJsonValue,
        requestedById: ctx.userId,
        // 7-day signed-URL validity window for generated artifacts.
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
  }

  async list(params: { type?: ReportType; skip: number; take: number }) {
    const db = this.prisma.forRequest();
    const where: Prisma.ReportWhereInput = params.type ? { type: params.type } : {};
    const [data, total] = await Promise.all([
      db.report.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
      db.report.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(id: string) {
    const db = this.prisma.forRequest();
    const report = await db.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }
}
