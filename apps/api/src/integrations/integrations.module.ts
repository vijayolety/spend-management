import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationRunnerService } from './integration-runner.service';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationsController],
  providers: [IntegrationRunnerService, IntegrationsService],
  exports: [IntegrationRunnerService],
})
export class IntegrationsModule {}
