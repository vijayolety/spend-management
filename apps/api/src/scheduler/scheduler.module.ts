import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [PrismaModule, MailModule, IntegrationsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
