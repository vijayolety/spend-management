import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateBudgetDto {
  scopeType: 'ORG' | 'DEPARTMENT' | 'TOOL';
  scopeId: string;
  departmentId?: string;
  toolId?: string;
  periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  periodStart: string;
  periodEnd: string;
  allocatedAmount: number;
  rolloverEnabled?: boolean;
}

@Injectable()
export class BudgetsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(orgId: string, actorId: string, dto: CreateBudgetDto) {
    const budget = await this.prisma.budget.create({
      data: {
        orgId,
        scopeType: dto.scopeType,
        scopeId: dto.scopeId,
        departmentId: dto.departmentId,
        toolId: dto.toolId,
        periodType: dto.periodType,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        allocatedAmount: dto.allocatedAmount,
        rolloverEnabled: dto.rolloverEnabled || false,
      },
    });
    await this.audit.log(orgId, actorId, 'budget.created', 'Budget', budget.id, null, budget);
    return budget;
  }

  async listByOrg(orgId: string, scopeType?: string) {
    return this.prisma.budget.findMany({
      where: { orgId, ...(scopeType ? { scopeType: scopeType as any } : {}) },
      orderBy: { periodStart: 'desc' },
    });
  }

  async findById(id: string, orgId: string) {
    const b = await this.prisma.budget.findFirst({ where: { id, orgId } });
    if (!b) throw new NotFoundException('Budget not found');
    return b;
  }

  async revise(id: string, orgId: string, actorId: string, newAmount: number, reason: string) {
    const b = await this.findById(id, orgId);
    await this.prisma.budgetRevision.create({
      data: {
        budgetId: id,
        previousAmount: b.allocatedAmount,
        newAmount,
        reason,
        revisedByUserId: actorId,
      },
    });
    const updated = await this.prisma.budget.update({
      where: { id },
      data: { allocatedAmount: newAmount },
    });
    await this.audit.log(orgId, actorId, 'budget.revised', 'Budget', id, { allocatedAmount: b.allocatedAmount }, { allocatedAmount: newAmount });
    return updated;
  }

  async getDepartmentSummary(departmentId: string, orgId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { orgId, departmentId, isLocked: false },
    });
    const tools = await this.prisma.tool.findMany({
      where: { orgId, departmentId, deletedAt: null },
      select: { id: true, name: true, barPct: true, capAmount: true, usedAmount: true },
    });

    const totals = budgets.reduce(
      (acc, b) => ({
        allocated: acc.allocated + b.allocatedAmount,
        spent: acc.spent + b.spentAmount,
        reserved: acc.reserved + b.reservedAmount,
      }),
      { allocated: 0, spent: 0, reserved: 0 },
    );

    return {
      ...totals,
      available: totals.allocated - totals.spent - totals.reserved,
      tools,
    };
  }
}
