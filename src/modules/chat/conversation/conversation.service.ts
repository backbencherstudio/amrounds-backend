import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { MessageGateway } from '../message/message.gateway';
import { Role } from '../../../common/guard/role/role.enum';

@Injectable()
export class ConversationService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
  ) {}

  async create(user_id: string, createConversationDto: CreateConversationDto) {
    try {
      const data: any = {};

      if (user_id) {
        data.creator_id = user_id;
      }
      if (createConversationDto.participant_id) {
        data.participant_id = createConversationDto.participant_id;
      }

      // check if conversation exists
      let conversation = await this.prisma.conversation.findFirst({
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
        where: {
          creator_id: data.creator_id,
          participant_id: data.participant_id,
        },
      });

      const addAvatarUrl = (conv) => {
        if (conv.creator.avatar) {
          Object.assign(conv.creator, {
            avatar_url: SojebStorage.url(
              appConfig().storageUrl.avatar + conv.creator.avatar,
            ),
          });
        }
        if (conv.participant.avatar) {
          Object.assign(conv.participant, {
            avatar_url: SojebStorage.url(
              appConfig().storageUrl.avatar + conv.participant.avatar,
            ),
          });
        }
      };

      if (conversation) {
        addAvatarUrl(conversation);
        return {
          success: false,
          message: 'Conversation already exists',
          data: conversation,
        };
      }

      conversation = await this.prisma.conversation.create({
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
        data: {
          ...data,
        },
      });

      // add image url
      addAvatarUrl(conversation);

      // trigger socket event
      this.messageGateway.server.to(data.creator_id).emit('conversation', {
        from: data.creator_id,
        data: conversation,
      });
      this.messageGateway.server.to(data.participant_id).emit('conversation', {
        from: data.participant_id,
        data: conversation,
      });

      return {
        success: true,
        message: 'Conversation created successfully',
        data: conversation,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll(user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: user_id } });
      const isAdmin = user?.type === Role.ADMIN;
      
      let adminIds = [];
      if (isAdmin) {
        const admins = await this.prisma.user.findMany({ where: { type: Role.ADMIN }, select: { id: true } });
        adminIds = admins.map(a => a.id);
      }

      const orConditions: any = [
        { creator_id: user_id }, 
        { participant_id: user_id }
      ];

      if (isAdmin) {
        orConditions.push({ participant_id: { in: adminIds } });
      }

      const conversations = await this.prisma.conversation.findMany({
        orderBy: {
          updated_at: 'desc',
        },
        where: {
          OR: orConditions,
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
      });

      // add image url
      for (const conversation of conversations) {
        if (conversation.creator && conversation.creator.avatar) {
          conversation.creator['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + conversation.creator.avatar,
          );
        }
        if (conversation.participant && conversation.participant.avatar) {
          conversation.participant['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + conversation.participant.avatar,
          );
        }
      }

      return {
        success: true,
        data: conversations,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(user_id: string, id: string) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: {
          id,
          OR: [{ creator_id: user_id }, { participant_id: user_id }],
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // add image url
      if (conversation.creator.avatar) {
        conversation.creator['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.creator.avatar,
        );
      }
      if (conversation.participant.avatar) {
        conversation.participant['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.participant.avatar,
        );
      }

      return {
        success: true,
        data: conversation,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(id: string, updateConversationDto: UpdateConversationDto) {
    try {
      const data = {};
      if (id) {
        data['creator_id'] = id;
      }
      if (updateConversationDto.participant_id) {
        data['participant_id'] = updateConversationDto.participant_id;
      }

      await this.prisma.conversation.update({
        where: { id },
        data: {
          ...data,
          updated_at: DateHelper.now(),
        },
      });

      return {
        success: true,
        message: 'Conversation updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(user_id: string, id: string) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: {
          id,
          OR: [{ creator_id: user_id }, { participant_id: user_id }],
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      await this.prisma.conversation.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Conversation deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async createAdminConversation(user_id: string) {
    try {
      // Find all admins
      const admins = await this.prisma.user.findMany({
        where: {
          type: Role.ADMIN,
        },
      });

      if (!admins.length) {
        return {
          success: false,
          message: 'No admin found',
        };
      }

      const addAvatarUrl = (conv) => {
        if (conv.creator?.avatar) {
          Object.assign(conv.creator, {
            avatar_url: SojebStorage.url(
              appConfig().storageUrl.avatar + conv.creator.avatar,
            ),
          });
        }
        if (conv.participant?.avatar) {
          Object.assign(conv.participant, {
            avatar_url: SojebStorage.url(
              appConfig().storageUrl.avatar + conv.participant.avatar,
            ),
          });
        }
      };

      // Just create one conversation with the first admin found, 
      // but all admins will be able to see it via findAll modifications.
      const admin = admins[0];

      let conversation = await this.prisma.conversation.findFirst({
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: { select: { id: true, name: true, avatar: true } },
          participant: { select: { id: true, name: true, avatar: true } },
        },
        where: {
          OR: [
            { creator_id: user_id, participant_id: admin.id },
            { creator_id: admin.id, participant_id: user_id },
          ],
        },
      });

      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          select: {
            id: true,
            creator_id: true,
            participant_id: true,
            created_at: true,
            updated_at: true,
            creator: { select: { id: true, name: true, avatar: true } },
            participant: { select: { id: true, name: true, avatar: true } },
          },
          data: {
            creator_id: user_id,
            participant_id: admin.id,
          },
        });

        addAvatarUrl(conversation);

        this.messageGateway.server.to(user_id).emit('conversation', {
          from: user_id,
          data: conversation,
        });
        
        // Notify all admins about the new support conversation
        for (const ad of admins) {
          const socketId = this.messageGateway.clients.get(ad.id);
          if (socketId) {
            this.messageGateway.server.to(socketId).emit('conversation', {
              from: user_id,
              data: conversation,
            });
          }
        }
      } else {
        addAvatarUrl(conversation);
      }

      return {
        success: true,
        message: 'Admin conversation created successfully',
        data: conversation,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
