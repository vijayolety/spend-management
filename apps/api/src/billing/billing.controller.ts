import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private billing: BillingService) {}

  @Get()
  list(@Req() req: any, @Query() q: any) {
    return this.billing.list(req.user.orgId, {
      monthKey: q.monthKey,
      toolId: q.toolId,
      status: q.status,
    });
  }

  @Post()
  create(@Req() req: any, @Body() body: { toolId: string; monthKey: string; amount: number }) {
    return this.billing.create(req.user.orgId, req.user.sub, body);
  }

  @Patch(':id/mark-paid')
  markPaid(@Param('id') id: string, @Req() req: any) {
    return this.billing.markPaid(id, req.user.orgId, req.user.sub);
  }

  @Get('month-summary')
  monthSummary(@Req() req: any) {
    return this.billing.monthSummary(req.user.orgId);
  }
}
