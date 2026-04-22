import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { MessageStatus } from 'prisma/generated/enums';

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * Update message status
   * @returns
   */
  async updateMessageStatus(message_id: string, status: MessageStatus) {
    // if message exist
    const message = await this.prisma.message.findFirst({
      where: {
        id: message_id,
      },
    });

    if (!message) {
      return;
    }

    await this.prisma.message.update({
      where: {
        id: message_id,
      },
      data: {
        status,
      },
    });
  }

  /**
   * Update user status
   * @returns
   */
  async updateUserStatus(user_id: string, status: string) {
    try {
      // Use updateMany to avoid unnecessary findFirst query and handle non-existent users gracefully
      return await this.prisma.user.updateMany({
        where: { id: user_id },
        data: {
          availability: status,
        },
      });
    } catch (error) {
      console.error(`Failed to update user status for ${user_id}:`, error);
      // We don't throw here to prevent crashing the gateway/socket during disconnects
    }
  }

}
