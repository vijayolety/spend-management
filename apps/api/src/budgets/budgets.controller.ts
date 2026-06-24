import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BudgetsService, CreateBudgetDto } from './budgets.service';
import { BudgetEngine } from './budget.engine';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(
    private budgets: BudgetsService,
    private engine: BudgetEngine,
  ) {}

  @Get()
  list(@Req() req: any, @Query('scopeType') scopeType?: string) {
    return this.budgets.listByOrg(req.user.orgId, scopeType);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateBudgetDto) {
    return this.budgets.create(req.user.orgId, req.user.sub, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.budgets.findById(id, req.user.orgId);
  }

  @Get(':id/utilization')
  utilization(@Param('id') id: string) {
    return this.engine.getUtilization(id);
  }

  @Patch(':id/revise')
  revise(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { newAmount: number; reason: string },
  ) {
    return this.budgets.revise(id, req.user.orgId, req.user.sub, body.newAmount, body.reason);
  }
}
