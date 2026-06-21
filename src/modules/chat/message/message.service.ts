import { Injectable } from '@nestjs/common';

import appConfig from '../../../config/app.config';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatRepository } from '../../../common/repository/chat/chat.repository';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { MessageGateway } from './message.gateway';
import { UserRepository } from '../../../common/repository/user/user.repository';
import { Role } from '../../../common/guard/role/role.enum';
import { MessageStatus } from 'prisma/generated/enums';
import { CreateAdminMessageDto } from './dto/create-admin-message.dto';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
    private notificationRepository: NotificationRepository,
    private userRepository: UserRepository,
    private chatRepository: ChatRepository,
  ) { }

  async create(
    user_id: string,
    createMessageDto: CreateMessageDto,
    files?: Array<Express.Multer.File>,
  ) {
    try {
      const data: any = {};

      if (createMessageDto.conversation_id) {
        data.conversation_id = createMessageDto.conversation_id;
      }

      if (createMessageDto.receiver_id) {
        data.receiver_id = createMessageDto.receiver_id;
      }

      if (createMessageDto.message) {
        data.message = createMessageDto.message;
      }

      // check if conversation exists
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: data.conversation_id,
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      // check if receiver exists
      const receiver = await this.prisma.user.findFirst({
        where: {
          id: data.receiver_id,
        },
      });

      if (!receiver) {
        return {
          success: false,
          message: 'Receiver not found',
        };
      }

      const message = await this.prisma.message.create({
        data: {
          ...data,
          status: MessageStatus.SENT,
          sender_id: user_id,
        },
      });

      const attachments = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileName = `${DateHelper.now().getTime()}_${file.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.attachment + '/' + fileName,
            file.buffer,
          );
          const attachment = await this.prisma.attachment.create({
            data: {
              name: fileName,
              type: file.mimetype,
              size: file.size,
              file: fileName,
              message_id: message.id,
            },
          });
          attachment['file_url'] = await SojebStorage.url(
            appConfig().storageUrl.attachment + '/' + fileName,
          );
          attachments.push(attachment);
        }
      }

      // update conversation updated_at
      await this.prisma.conversation.update({
        where: {
          id: data.conversation_id,
        },
        data: {
          updated_at: DateHelper.now(),
        },
      });

      const sender = await this.prisma.user.findFirst({
        where: {
          id: user_id,
        },
      });

      const messageNotificationPayload: any = {
        sender_id: user_id,
        receiver_id: data.receiver_id,
        message: `You have a new message from ${sender?.name}`,
        last_message: createMessageDto.message,
        type: 'message',
      };

      await this.notificationRepository.createNotification(
        messageNotificationPayload,
      );


      // this.messageGateway.server
      //   .to(this.messageGateway.clients.get(data.receiver_id))
      //   .emit('message', { from: data.receiver_id, data: message });

      return {
        success: true,
        data: {
          ...message,
          attachments,
        },
        message: 'Message sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async postMessageToAdmin(
    user_id: string,
    createAdminMessageDto: CreateAdminMessageDto,
    files?: Array<Express.Multer.File>,
  ) {
    try {
      const data: any = {};

      if (createAdminMessageDto.conversation_id) {
        data.conversation_id = createAdminMessageDto.conversation_id;
      }

      if (createAdminMessageDto.receiver_id) {
        data.receiver_id = createAdminMessageDto.receiver_id;
      }

      if (createAdminMessageDto.message) {
        data.message = createAdminMessageDto.message;
      }

      // check if conversation exists
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: data.conversation_id,
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      // If receiver_id is provided, check if receiver exists
      if (data.receiver_id) {
        const receiver = await this.prisma.user.findFirst({
          where: {
            id: data.receiver_id,
          },
        });

        if (!receiver) {
          return {
            success: false,
            message: 'Receiver not found',
          };
        }
      }

      const message = await this.prisma.message.create({
        data: {
          ...data,
          status: MessageStatus.SENT,
          sender_id: user_id,
        },
      });

      const attachments = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileName = `${DateHelper.now().getTime()}_${file.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.attachment + '/' + fileName,
            file.buffer,
          );
          const attachment = await this.prisma.attachment.create({
            data: {
              name: fileName,
              type: file.mimetype,
              size: file.size,
              file: fileName,
              message_id: message.id,
            },
          });
          attachment['file_url'] = await SojebStorage.url(
            appConfig().storageUrl.attachment + '/' + fileName,
          );
          attachments.push(attachment);
        }
      }

      // update conversation updated_at
      await this.prisma.conversation.update({
        where: {
          id: data.conversation_id,
        },
        data: {
          updated_at: DateHelper.now(),
        },
      });

      const sender = await this.prisma.user.findFirst({
        where: {
          id: user_id,
        },
      });

      if (data.receiver_id) {
        const messageNotificationPayload: any = {
          sender_id: user_id,
          receiver_id: data.receiver_id,
          message: `You have a new message from ${sender?.name}`,
          last_message: data.message,
          type: 'message',
        };

        await this.notificationRepository.createNotification(
          messageNotificationPayload,
        );
      } else {
        // Broadcast to all admins if receiver_id wasn't provided!
        const messageData = {
          message: {
            id: message.id,
            message_id: message.id,
            body_text: message.message,
            from: message.sender_id,
            conversation_id: message.conversation_id,
            created_at: message.created_at,
            attachments: attachments,
          },
        };

        const admins = await this.prisma.user.findMany({
          where: { type: Role.ADMIN, id: { not: user_id } },
          select: { id: true },
        });

        for (const admin of admins) {
          const socketId = this.messageGateway.clients.get(admin.id);
          if (socketId) {
            this.messageGateway.server.to(socketId).emit('message', {
              from: user_id,
              data: messageData,
            });
          }

          const messageNotificationPayload: any = {
            sender_id: user_id,
            receiver_id: admin.id,
            message: `You have a new message from ${sender.first_name} ${sender.last_name}`,
            last_message: data.message,
            type: 'message',
          };

          await this.notificationRepository.createNotification(
            messageNotificationPayload,
          );
        }
      }

      return {
        success: true,
        data: {
          ...message,
          attachments,
        },
        message: 'Message sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll({
    user_id,
    conversation_id,
    limit = 20,
    cursor,
  }: {
    user_id: string;
    conversation_id: string;
    limit?: number;
    cursor?: string;
  }) {
    try {
      const userDetails = await this.userRepository.getUserDetails(user_id);

      const where_condition = {
        AND: [{ id: conversation_id }],
      };

      if (userDetails.type != Role.ADMIN) {
        where_condition['OR'] = [
          { creator_id: user_id },
          { participant_id: user_id },
        ];
      }

      const conversation = await this.prisma.conversation.findFirst({
        where: {
          ...where_condition,
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      const paginationData = {};
      if (limit) {
        paginationData['take'] = limit;
      }
      if (cursor) {
        paginationData['cursor'] = cursor ? { id: cursor } : undefined;
      }

      const messages = await this.prisma.message.findMany({
        ...paginationData,
        where: {
          conversation_id: conversation_id,
        },
        orderBy: {
          created_at: 'desc',
        },
        select: {
          id: true,
          message: true,
          created_at: true,
          status: true,
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },

          attachments: {
            select: {
              id: true,
              name: true,
              type: true,
              size: true,
              file: true,
            },
          },
        },
      });

      // add attachment url
      for (const message of messages) {
        if (message.attachments) {
          for (const attachment of message.attachments) {
            attachment['file_url'] = await SojebStorage.url(
              appConfig().storageUrl.attachment + '/' + attachment.file,
            );
          }
        }
      }

      // add image url
      for (const message of messages) {
        if (message.sender && message.sender.avatar) {
          message.sender['avatar_url'] = await SojebStorage.url(
            appConfig().storageUrl.avatar + '/' + message.sender.avatar,
          );
        }
        if (message.receiver && message.receiver.avatar) {
          message.receiver['avatar_url'] = await SojebStorage.url(
            appConfig().storageUrl.avatar + '/' + message.receiver.avatar,
          );
        }
      }

      return {
        success: true,
        data: messages,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateMessageStatus(message_id: string, status: MessageStatus) {
    return await this.chatRepository.updateMessageStatus(message_id, status);
  }

  async readMessage(message_id: string) {
    return await this.chatRepository.updateMessageStatus(
      message_id,
      MessageStatus.READ,
    );
  }

  async updateUserStatus(user_id: string, status: string) {
    return await this.chatRepository.updateUserStatus(user_id, status);
  }
}
