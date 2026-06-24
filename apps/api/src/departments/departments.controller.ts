import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DepartmentsService, CreateDepartmentDto } from './departments.service';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private depts: DepartmentsService) {}

  @Get()
  list(@Req() req: any) {
    return this.depts.listByOrg(req.user.orgId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateDepartmentDto) {
    return this.depts.create(req.user.orgId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.depts.findById(id, req.user.orgId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.depts.softDelete(id, req.user.orgId);
  }
}
