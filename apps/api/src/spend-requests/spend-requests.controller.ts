import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Req, UseGuards, HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpendRequestsService, CreateSpendRequestDto } from './spend-requests.service';
import { ApprovalEngine } from './approval.engine';

@Controller('spend-requests')
@UseGuards(JwtAuthGuard)
export class SpendRequestsController {
  constructor(
    private requests: SpendRequestsService,
    private approval: ApprovalEngine,
  ) {}

  @Get()
  list(@Req() req: any, @Query() query: any) {
    return this.requests.list(req.user.orgId, {
      status: query.status,
      departmentId: query.departmentId,
      requesterId: query.mine ? req.user.sub : undefined,
    });
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateSpendRequestDto) {
    return this.requests.create(req.user.orgId, req.user.sub, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.requests.findById(id, req.user.orgId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() dto: Partial<CreateSpendRequestDto>) {
    return this.requests.update(id, req.user.orgId, req.user.sub, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@Param('id') id: string, @Req() req: any) {
    return this.approval.submit(id, req.user.sub);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string, @Req() req: any, @Body() body: { comment?: string; approvedAmount?: number }) {
    return this.approval.approve(id, req.user.sub, body.comment || '', body.approvedAmount);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string, @Req() req: any, @Body() body: { comment: string }) {
    return this.approval.reject(id, req.user.sub, body.comment);
  }

  @Post(':id/request-info')
  @HttpCode(200)
  requestInfo(@Param('id') id: string, @Req() req: any, @Body() body: { comment: string }) {
    return this.approval.requestMoreInfo(id, req.user.sub, body.comment);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.requests.cancel(id, req.user.orgId, req.user.sub);
  }

  @Post(':id/revise')
  revise(@Param('id') id: string, @Req() req: any) {
    return this.requests.createRevision(id, req.user.orgId, req.user.sub);
  }

  @Post(':id/comments')
  addComment(@Param('id') id: string, @Req() req: any, @Body() body: { body: string }) {
    return this.requests.addComment(id, req.user.orgId, req.user.sub, body.body);
  }
}
