import { Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant-context';
import {
  AddNoteDto,
  AssignCaseDto,
  CreateCaseDto,
  UpdateCaseStatusDto,
} from './dto/cases.dto';

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    return TenantContext.require();
  }

  /** RV-YYYY-NNNNNN, sequential per tenant per year (RLS scopes the count). */
  private async nextCaseNumber(): Promise<string> {
    const db = this.prisma.forRequest();
    const year = new Date().getFullYear();
    const count = await db.fraudCase.count({
      where: { caseNumber: { startsWith: `RV-${year}-` } },
    });
    return `RV-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  async create(dto: CreateCaseDto) {
    const db = this.prisma.forRequest();
    const orgId = this.ctx().organizationId;
    const caseNumber = await this.nextCaseNumber();

    const created = await db.fraudCase.create({
      data: {
        organizationId: orgId,
        caseNumber,
        title: dto.title,
        priority: dto.priority,
        providerId: dto.providerId,
        summary: dto.summary,
        exposureCents: dto.exposureCents,
      },
    });

    if (dto.fraudEventIds?.length) {
      await db.fraudEvent.updateMany({
        where: { id: { in: dto.fraudEventIds } },
        data: { caseId: created.id, status: 'LINKED_TO_CASE' },
      });
    }
    return created;
  }

  async list(params: { status?: CaseStatus; skip: number; take: number }) {
    const db = this.prisma.forRequest();
    const where: Prisma.FraudCaseWhereInput = params.status ? { status: params.status } : {};
    const [data, total] = await Promise.all([
      db.fraudCase.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { openedAt: 'desc' }],
        skip: params.skip,
        take: params.take,
        include: { assignee: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { events: true } } },
      }),
      db.fraudCase.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(id: string) {
    const db = this.prisma.forRequest();
    const found = await db.fraudCase.findUnique({
      where: { id },
      include: {
        events: { orderBy: { detectedAt: 'desc' } },
        notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { firstName: true, lastName: true } } } },
        evidence: true,
        assignee: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, legalName: true } },
      },
    });
    if (!found) throw new NotFoundException('Case not found');
    return found;
  }

  async assign(id: string, dto: AssignCaseDto) {
    const db = this.prisma.forRequest();
    await this.ensureExists(id);
    return db.fraudCase.update({ where: { id }, data: { assigneeId: dto.assigneeId } });
  }

  async updateStatus(id: string, dto: UpdateCaseStatusDto) {
    const db = this.prisma.forRequest();
    await this.ensureExists(id);
    const closing = dto.status === CaseStatus.CLOSED || dto.status === CaseStatus.SUBSTANTIATED || dto.status === CaseStatus.UNSUBSTANTIATED;
    return db.fraudCase.update({
      where: { id },
      data: { status: dto.status, closedAt: closing ? new Date() : null },
    });
  }

  async addNote(id: string, dto: AddNoteDto) {
    const db = this.prisma.forRequest();
    await this.ensureExists(id);
    return db.caseNote.create({
      data: {
        caseId: id,
        authorId: this.ctx().userId!,
        body: dto.body,
        isInternal: dto.isInternal ?? true,
      },
    });
  }

  private async ensureExists(id: string) {
    const db = this.prisma.forRequest();
    const exists = await db.fraudCase.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Case not found');
  }
}
