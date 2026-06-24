import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(orgId: string, filters: { monthKey?: string; toolId?: string; status?: string }) {
    const where: any = { orgId };
    if (filters.monthKey) where.monthKey = filters.monthKey;
    if (filters.toolId) where.toolId = filters.toolId;
    if (filters.status) where.status = filters.status;

    return this.prisma.billingRecord.findMany({
      where,
      include: {
        tool: { select: { id: true, name: true, monoInitials: true, monoBgColor: true } },
      },
      orderBy: [{ monthKey: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(orgId: string, actorId: string, dto: {
    toolId: string;
    monthKey: string;
    amount: number;
  }) {
    const tool = await this.prisma.tool.findFirst({ where: { id: dto.toolId, orgId } });
    if (!tool) throw new NotFoundException('Tool not found');

    const monthLabel = this.formatMonthLabel(dto.monthKey);

    const record = await this.prisma.billingRecord.create({
      data: {
        orgId,
        toolId: dto.toolId,
        toolSnapshotJson: { name: tool.name, vendor: tool.vendor, category: tool.category },
        monthKey: dto.monthKey,
        monthLabel,
        amount: dto.amount,
        status: 'PENDING',
      },
    });

    await this.audit.log(orgId, actorId, 'billing.created', 'BillingRecord', record.id, null, record);
    return record;
  }

  async markPaid(id: string, orgId: string, actorId: string) {
    const record = await this.prisma.billingRecord.findFirst({ where: { id, orgId } });
    if (!record) throw new NotFoundException('Billing record not found');

    const updated = await this.prisma.billingRecord.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), paidByUserId: actorId },
    });

    await this.audit.log(orgId, actorId, 'billing.marked_paid', 'BillingRecord', id, record, updated);
    return updated;
  }

  async monthSummary(orgId: string) {
    const records = await this.prisma.billingRecord.groupBy({
      by: ['monthKey'],
      where: { orgId },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { monthKey: 'desc' },
      take: 12,
    });

    return records.map((r) => ({
      monthKey: r.monthKey,
      monthLabel: this.formatMonthLabel(r.monthKey),
      total: r._sum.amount || 0,
      count: r._count.id,
    }));
  }

  private formatMonthLabel(monthKey: string): string {
    const [year, month] = monthKey.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(month) - 1]} ${year}`;
  }
}
