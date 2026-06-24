import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('dashboard-kpis')
  dashboardKpis(@Req() req: any) {
    return this.reports.dashboardKpis(req.user.orgId);
  }

  @Get('spend-by-category')
  spendByCategory(@Req() req: any, @Query('monthKey') monthKey?: string) {
    return this.reports.spendByCategory(req.user.orgId, monthKey);
  }

  @Get('spend-by-department')
  spendByDepartment(@Req() req: any, @Query('monthKey') monthKey?: string) {
    return this.reports.spendByDepartment(req.user.orgId, monthKey);
  }

  @Get('billing-history')
  billingHistory(@Req() req: any, @Query() q: any) {
    return this.reports.billingHistory(req.user.orgId, {
      monthKey: q.monthKey,
      toolId: q.toolId,
      status: q.status,
      page: q.page ? parseInt(q.page) : 1,
      limit: q.limit ? parseInt(q.limit) : 20,
    });
  }

  @Get('approval-sla')
  approvalSla(@Req() req: any) {
    return this.reports.approvalSla(req.user.orgId);
  }

  @Get('forecasted-spend')
  forecastedSpend(@Req() req: any, @Query('months') months?: string) {
    return this.reports.forecastedSpend(req.user.orgId, months ? parseInt(months) : 3);
  }
}
