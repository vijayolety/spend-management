import { Controller, Get, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.users.findById(req.user.sub);
  }

  @Patch('me')
  updateMe(@Req() req: any, @Body() body: { name: string }) {
    return this.users.updateProfile(req.user.sub, body.name);
  }

  @Get()
  list(@Req() req: any) {
    return this.users.listByOrg(req.user.orgId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }
}
