import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * Create a notification
   * @param sender_id - The ID of the user who fired the event
   * @param receiver_id - The ID of the user to notify
   * @param text - The text of the notification
   * @param type - The type of the notification
   * @param entity_id - The ID of the entity related to the notification
   * @returns The created notification
   */
  async createNotification({
    sender_id,
    receiver_id,
    text,
    type,
    entity_id,
  }: {
    sender_id?: string;
    receiver_id?: string;
    text?: string;
    type?:
      | 'message'
      | 'comment'
      | 'review'
      | 'booking'
      | 'payment_transaction'
      | 'package'
      | 'blog';
    entity_id?: string;
  }) {
    const notificationEventData = {};
    if (type) {
      notificationEventData['type'] = type;
    }
    if (text) {
      notificationEventData['text'] = text;
    }
    const notificationEvent = await this.prisma.notificationEvent.create({
      data: {
        type: type,
        text: text,
        ...notificationEventData,
      },
    });

    const notificationData = {};
    if (sender_id) {
      notificationData['sender_id'] = sender_id;
    }
    if (receiver_id) {
      notificationData['receiver_id'] = receiver_id;
    }
    if (entity_id) {
      notificationData['entity_id'] = entity_id;
    }

    const notification = await this.prisma.notification.create({
      data: {
        notification_event_id: notificationEvent.id,
        ...notificationData,
      },
    });

    return notification;
  }

  async deleteNotification({
    sender_id,
    receiver_id,
    type,
    entity_id,
  }: {
    sender_id?: string;
    receiver_id?: string;
    type?: string;
    entity_id?: string;
  }) {
    const whereCondition: any = {};
    if (sender_id) {
      whereCondition.sender_id = sender_id;
    }
    if (receiver_id) {
      whereCondition.receiver_id = receiver_id;
    }
    if (type) {
      whereCondition.notification_event = {
        type: type,
      };
    }
    if (entity_id) {
      whereCondition.entity_id = entity_id;
    }

    const notification = await this.prisma.notification.findFirst({
      where: whereCondition,
    });

    if (notification) {
      await this.prisma.notification.delete({
        where: {
          id: notification.id,
        },
      });
      // also delete notification event
      if (notification.notification_event_id) {
        await this.prisma.notificationEvent.delete({
          where: {
            id: notification.notification_event_id,
          },
        });
      }
    }
  }
}
