import { Controller, Get, Put, Delete, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private integrations: IntegrationsService) {}

  // Must be before :toolId routes or NestJS matches "preview-limits" as a toolId
  @Post('preview-limits')
  previewLimits(@Body() body: any) {
    return this.integrations.previewLimits(body.provider, body.config);
  }

  @Get(':toolId')
  get(@Param('toolId') toolId: string, @Req() req: any) {
    return this.integrations.get(toolId, req.user.orgId);
  }

  @Put(':toolId')
  upsert(@Param('toolId') toolId: string, @Body() body: any, @Req() req: any) {
    return this.integrations.upsert(toolId, req.user.orgId, body);
  }

  @Delete(':toolId')
  remove(@Param('toolId') toolId: string, @Req() req: any) {
    return this.integrations.remove(toolId, req.user.orgId);
  }

  @Get(':toolId/limits')
  fetchLimits(@Param('toolId') toolId: string, @Req() req: any) {
    return this.integrations.fetchLimits(toolId, req.user.orgId);
  }

  @Post(':toolId/sync')
  syncNow(@Param('toolId') toolId: string, @Req() req: any) {
    return this.integrations.syncNow(toolId, req.user.orgId);
  }
}
