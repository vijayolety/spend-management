import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async spendByCategory(orgId: string, monthKey?: string) {
    const where: any = { orgId };
    where.monthKey = monthKey || new Date().toISOString().slice(0, 7);

    const records = await this.prisma.billingRecord.findMany({
      where,
      include: { tool: { select: { category: true, name: true } } },
    });

    const grouped: Record<string, { category: string; total: number; count: number }> = {};
    let grandTotal = 0;

    for (const r of records) {
      const cat = r.tool?.category || (r.toolSnapshotJson as any)?.category || 'OTHER';
      if (!grouped[cat]) grouped[cat] = { category: cat, total: 0, count: 0 };
      grouped[cat].total += r.amount;
      grouped[cat].count++;
      grandTotal += r.amount;
    }

    return Object.values(grouped).map((g) => ({
      ...g,
      pct: grandTotal > 0 ? Math.round((g.total / grandTotal) * 100) : 0,
    }));
  }

  async spendByDepartment(orgId: string, monthKey?: string) {
    const tools = await this.prisma.tool.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true, departmentId: true, department: { select: { name: true } } },
    });

    const toolDeptMap = new Map(tools.map((t) => [t.id, { deptId: t.departmentId, deptName: t.department?.name }]));

    const where: any = { orgId };
    if (monthKey) where.monthKey = monthKey;

    const records = await this.prisma.billingRecord.findMany({ where });

    const grouped: Record<string, { department: string; total: number }> = {};
    for (const r of records) {
      if (!r.toolId) continue;
      const dept = toolDeptMap.get(r.toolId);
      const key = dept?.deptId || 'unknown';
      const name = dept?.deptName || 'Unknown';
      if (!grouped[key]) grouped[key] = { department: name, total: 0 };
      grouped[key].total += r.amount;
    }

    return Object.values(grouped);
  }

  async billingHistory(orgId: string, filters: { monthKey?: string; toolId?: string; status?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const where: any = { orgId };
    if (filters.monthKey) where.monthKey = filters.monthKey;
    if (filters.toolId) where.toolId = filters.toolId;
    if (filters.status) where.status = filters.status;

    const [items, total] = await Promise.all([
      this.prisma.billingRecord.findMany({
        where,
        include: { tool: { select: { name: true, monoInitials: true, monoBgColor: true, category: true } } },
        orderBy: [{ monthKey: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.billingRecord.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async approvalSla(orgId: string) {
    // Average hours between request.submitted and final approval action
    const actions = await this.prisma.approvalAction.findMany({
      where: {
        action: { in: ['APPROVED', 'REJECTED'] },
        spendRequest: { orgId },
      },
      include: {
        spendRequest: { select: { createdAt: true, departmentId: true, department: { select: { name: true } } } },
      },
    });

    const deptTotals: Record<string, { dept: string; totalHours: number; count: number }> = {};

    for (const a of actions) {
      const deptId = a.spendRequest.departmentId;
      const deptName = a.spendRequest.department?.name || deptId;
      const hours =
        (new Date(a.createdAt).getTime() - new Date(a.spendRequest.createdAt).getTime()) / 3600000;
      if (!deptTotals[deptId]) deptTotals[deptId] = { dept: deptName, totalHours: 0, count: 0 };
      deptTotals[deptId].totalHours += hours;
      deptTotals[deptId].count++;
    }

    return Object.values(deptTotals).map((d) => ({
      department: d.dept,
      avgHours: d.count > 0 ? Math.round(d.totalHours / d.count) : 0,
      count: d.count,
    }));
  }

  async forecastedSpend(orgId: string, months = 3) {
    // Simple linear regression on last 6 months of billing totals
    const history = await this.prisma.billingRecord.groupBy({
      by: ['monthKey'],
      where: { orgId },
      _sum: { amount: true },
      orderBy: { monthKey: 'asc' },
      take: 6,
    });

    if (history.length < 2) return [];

    const totals = history.map((h) => h._sum.amount || 0);
    const n = totals.length;
    const sumX = n * (n - 1) / 2;
    const sumY = totals.reduce((a, b) => a + b, 0);
    const sumXY = totals.reduce((acc, y, i) => acc + i * y, 0);
    const sumX2 = totals.reduce((acc, _, i) => acc + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const lastMonth = history[history.length - 1].monthKey;
    const [lastYear, lastMo] = lastMonth.split('-').map(Number);

    return Array.from({ length: months }, (_, i) => {
      const mo = ((lastMo + i) % 12) + 1;
      const yr = lastYear + Math.floor((lastMo + i) / 12);
      const monthKey = `${yr}-${String(mo).padStart(2, '0')}`;
      const projected = Math.max(0, Math.round(intercept + slope * (n + i)));
      return { monthKey, projected };
    });
  }

  async dashboardKpis(orgId: string) {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const [totalThisMonth, alertCount, toolCount, noBudgetCount] = await Promise.all([
      this.prisma.billingRecord.aggregate({
        where: { orgId, monthKey: currentMonth },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM tools
        WHERE "orgId" = ${orgId} AND "deletedAt" IS NULL
          AND "paymentKind" != 'NOBUDGET'
          AND "barPct" >= "alertThresholdPct"
      `.then((r) => Number(r[0].count)),
      this.prisma.tool.count({ where: { orgId, deletedAt: null } }),
      this.prisma.tool.count({ where: { orgId, deletedAt: null, paymentKind: 'NOBUDGET' } }),
    ]);

    const nearestRenewal = await this.prisma.tool.findFirst({
      where: { orgId, deletedAt: null, renewalDate: { gte: new Date() } },
      orderBy: { renewalDate: 'asc' },
      select: { name: true, renewalDate: true },
    });

    return {
      totalMonthlySpend: totalThisMonth._sum.amount || 0,
      alertCount,
      toolCount,
      noBudgetCount,
      nearestRenewal: nearestRenewal
        ? {
            name: nearestRenewal.name,
            date: nearestRenewal.renewalDate,
            daysAway: Math.ceil(
              (new Date(nearestRenewal.renewalDate!).getTime() - Date.now()) / 86400000,
            ),
          }
        : null,
    };
  }
}
