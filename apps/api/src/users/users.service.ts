import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        initials: true,
        orgId: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        memberships: {
          select: { role: true, departmentId: true, isPrimary: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async listByOrg(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        initials: true,
        isActive: true,
        createdAt: true,
        memberships: {
          select: { role: true, departmentId: true, isPrimary: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateProfile(id: string, name: string) {
    const trimmed = name?.trim();
    if (!trimmed) return this.findById(id);
    const initials = trimmed.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    return this.prisma.user.update({
      where: { id },
      data: { name: trimmed, initials },
      select: { id: true, email: true, name: true, initials: true },
    });
  }

  async deactivate(id: string, actorOrgId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, orgId: actorOrgId },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
