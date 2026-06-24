import { Module } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { BudgetEngine } from './budget.engine';
import { BudgetsController } from './budgets.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [BudgetsService, BudgetEngine],
  controllers: [BudgetsController],
  exports: [BudgetsService, BudgetEngine],
})
export class BudgetsModule {}
