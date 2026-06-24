import { Module } from '@nestjs/common';
import { SpendRequestsService } from './spend-requests.service';
import { SpendRequestsController } from './spend-requests.controller';
import { ApprovalEngine } from './approval.engine';
import { BudgetsModule } from '../budgets/budgets.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [BudgetsModule, AuditModule, NotificationsModule],
  providers: [SpendRequestsService, ApprovalEngine],
  controllers: [SpendRequestsController],
  exports: [SpendRequestsService, ApprovalEngine],
})
export class SpendRequestsModule {}
