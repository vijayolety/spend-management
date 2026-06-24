import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateDepartmentDto {
  name: string;
  code: string;
  parentId?: string;
  ownerUserId?: string;
}

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async create(orgId: string, dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: { ...dto, orgId },
    });
  }

  async listByOrg(orgId: string) {
    return this.prisma.department.findMany({
      where: { orgId, deletedAt: null },
      include: {
        children: { where: { deletedAt: null } },
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { memberships: true, tools: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, orgId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, orgId, deletedAt: null },
      include: {
        memberships: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        tools: { where: { deletedAt: null } },
        _count: { select: { tools: true, memberships: true } },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async softDelete(id: string, orgId: string) {
    await this.findById(id, orgId);
    return this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
