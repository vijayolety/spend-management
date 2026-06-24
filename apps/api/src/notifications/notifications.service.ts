import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateNotificationDto {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  metadataJson?: any;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        orgId: dto.orgId,
        userId: dto.userId,
        type: dto.type as any,
        title: dto.title,
        body: dto.body,
        metadataJson: dto.metadataJson,
      },
    });
  }

  async listForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  // Notify the requester about a state change on their spend request
  async notifyRequester(request: any, status: string) {
    const messages: Record<string, { title: string; body: string }> = {
      APPROVED: {
        title: `Request approved: ${request.title}`,
        body: 'Your spend request has been approved.',
      },
      REJECTED: {
        title: `Request rejected: ${request.title}`,
        body: 'Your spend request has been rejected. You may revise and resubmit.',
      },
      MORE_INFO_NEEDED: {
        title: `More info needed: ${request.title}`,
        body: 'The approver has requested more information on your spend request.',
      },
    };

    const msg = messages[status];
    if (!msg) return;

    return this.create({
      orgId: request.orgId,
      userId: request.requesterId,
      type: 'THRESHOLD_BREACH',
      ...msg,
      metadataJson: { requestId: request.id, status },
    });
  }
}
