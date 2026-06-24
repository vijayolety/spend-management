import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BudgetEngine {
  constructor(private prisma: PrismaService) {}

  /**
   * Atomically reserve budget for an in-flight spend request.
   * Uses a single UPDATE with a WHERE guard to prevent concurrent over-spend.
   * Returns false if budget is insufficient.
   */
  async reserve(budgetId: string, amount: number): Promise<boolean> {
    const result = await this.prisma.$executeRaw`
      UPDATE budgets
      SET reserved_amount = reserved_amount + ${amount},
          updated_at = NOW()
      WHERE id = ${budgetId}
        AND is_locked = false
        AND (spent_amount + reserved_amount + ${amount}) <= allocated_amount
    `;
    // result = number of rows affected
    return result > 0;
  }

  /**
   * Commit a reservation to actual spend (called on final approval).
   * Moves reserved_amount → spent_amount.
   */
  async commit(budgetId: string, amount: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE budgets
      SET reserved_amount = GREATEST(0, reserved_amount - ${amount}),
          spent_amount    = spent_amount + ${amount},
          updated_at      = NOW()
      WHERE id = ${budgetId}
    `;
  }

  /**
   * Release a reservation (called on rejection or cancellation).
   */
  async release(budgetId: string, amount: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE budgets
      SET reserved_amount = GREATEST(0, reserved_amount - ${amount}),
          updated_at      = NOW()
      WHERE id = ${budgetId}
    `;
  }

  /**
   * Find the most applicable budget for a given scope, walking up the hierarchy.
   */
  async findBestBudget(
    orgId: string,
    departmentId: string | null,
    toolId: string | null,
    periodStart: Date,
  ) {
    // Try tool-level first, then department-level, then org-level
    if (toolId) {
      const b = await this.prisma.budget.findFirst({
        where: {
          orgId, scopeType: 'TOOL', toolId,
          periodStart: { lte: periodStart },
          periodEnd: { gte: periodStart },
          isLocked: false,
        },
      });
      if (b) return b;
    }

    if (departmentId) {
      const b = await this.prisma.budget.findFirst({
        where: {
          orgId, scopeType: 'DEPARTMENT', departmentId,
          periodStart: { lte: periodStart },
          periodEnd: { gte: periodStart },
          isLocked: false,
        },
      });
      if (b) return b;
    }

    return this.prisma.budget.findFirst({
      where: {
        orgId, scopeType: 'ORG',
        periodStart: { lte: periodStart },
        periodEnd: { gte: periodStart },
        isLocked: false,
      },
    });
  }

  async getUtilization(budgetId: string) {
    const b = await this.prisma.budget.findUnique({ where: { id: budgetId } });
    if (!b) return null;
    const available = b.allocatedAmount - b.spentAmount - b.reservedAmount;
    const utilPct = b.allocatedAmount > 0
      ? Math.round(((b.spentAmount + b.reservedAmount) / b.allocatedAmount) * 100)
      : 0;
    return { ...b, available, utilPct };
  }
}
