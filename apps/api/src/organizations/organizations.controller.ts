import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private orgs: OrganizationsService) {}

  @Get('me')
  getCurrent(@Req() req: any) {
    return this.orgs.findById(req.user.orgId);
  }

  @Patch('me')
  update(@Req() req: any, @Body() body: { name?: string; currency?: string }) {
    return this.orgs.update(req.user.orgId, body);
  }
}
