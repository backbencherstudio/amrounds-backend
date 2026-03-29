import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { GetAllUserDto, PaginationDto } from './dto/query-user.dto';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
    private messageGateway: MessageGateway,
    private notificationRepository: NotificationRepository,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const user = await this.userRepository.createUser(createUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll(query: GetAllUserDto) {
    try {
      const { page = 1, limit = 10 } = query;
      const where_condition = {};
      if (query.search) {
        where_condition['OR'] = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      if (query.type) {
        where_condition['type'] = query.type;
      }

      if (query.status == 'pending') {
        where_condition['approved_at'] = null;
        where_condition['approved'] = false;
        where_condition['rejected'] = false;
      }

      if (query.status == 'approved') {
        where_condition['approved_at'] = { not: null };
        where_condition['approved'] = true;
        where_condition['rejected'] = false;
      }

      if (query.status == 'rejected') {
        where_condition['approved_at'] = null;
        where_condition['approved'] = false;
        where_condition['rejected'] = true;
      }

      const users = await this.prisma.user.findMany({
        where: {
          ...where_condition,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
          avatar: true,
          verifiy_document: true,
          address: true,
          type: true,
          approved_at: true,
          approved: true,
          rejected: true,
          created_at: true,
          updated_at: true,
        },
        skip: (page - 1) * limit,
        take: limit,
      });

      const total = await this.prisma.user.count({ where: where_condition });

      users.forEach((user) => {
        if (user.avatar) {
          user['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + user.avatar,
          );
        }
        if (user.verifiy_document) {
          user['verifiy_document_url'] = SojebStorage.url(
            appConfig().storageUrl.verification_doc +
              '/' +
              user.verifiy_document,
          );
        }
      });

      return {
        success: true,
        data: users,
        meta_data: {
          page,
          limit,
          total,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
          phone_number: true,
          approved_at: true,
          approved: true,
          rejected: true,
          created_at: true,
          updated_at: true,
          avatar: true,
          billing_id: true,
        },
      });

      // add avatar url to user
      if (user.avatar) {
        user['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
        );
      }

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async approve(id: string) {
    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      await this.prisma.user.update({
        where: { id: id },
        data: {
          approved_at: DateHelper.now(),
          approved: true,
          rejected: false,
          verifiy_document: null,
        },
      });

      if (user.verifiy_document) {
        await SojebStorage.delete(
          appConfig().storageUrl.verification_doc + '/' + user.verifiy_document,
        );
      }

      await this.createActivity({
        title: 'User approved',
        description: `User ${user.name} has been approved`,
      });

      const approveNotificationPayload: any = {
        sender_id: null,
        receiver_id: user.id,
        message: 'Your account has been approved',
        type: 'approved',
      };

      await this.notificationRepository.createNotification(
        approveNotificationPayload,
      );

      const userSocketId = this.messageGateway.clients.get(user.id);
      if (userSocketId) {
        this.messageGateway.server.to(userSocketId).emit('approved', user);
      }

      return {
        success: true,
        message: 'User approved successfully',
      };
    } catch (error) {
      await this.createActivity({
        title: 'User approve failed',
        description: `User ${user.name} approve failed`,
      });
      throw error;
    }
  }

  async reject(id: string) {
    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      await this.prisma.user.update({
        where: { id: id },
        data: {
          approved_at: null,
          approved: false,
          rejected: true,
          verifiy_document: null,
        },
      });

      if (user.verifiy_document) {
        await SojebStorage.delete(
          appConfig().storageUrl.verification_doc + '/' + user.verifiy_document,
        );
      }

      await this.createActivity({
        title: 'User rejected',
        description: `User ${user.name} has been rejected`,
      });

      const rejectNotificationPayload: any = {
        sender_id: null,
        receiver_id: user.id,
        message: 'Your account has been rejected',
        type: 'rejected',
      };

      await this.notificationRepository.createNotification(
        rejectNotificationPayload,
      );

      const userSocketId = this.messageGateway.clients.get(user.id);
      if (userSocketId) {
        this.messageGateway.server.to(userSocketId).emit('rejected', user);
      }

      return {
        success: true,
        message: 'User rejected successfully',
      };
    } catch (error) {
      await this.createActivity({
        title: 'User reject failed',
        description: `User ${user.name} reject failed`,
      });
      throw error;
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.userRepository.updateUser(id, updateUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string) {
    try {
      const user = await this.userRepository.deleteUser(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async createActivity(activityDto: { title?: string; description?: string }) {
    try {
      await this.prisma.activity.create({
        data: activityDto,
      });
    } catch (error) {
      console.log(error);
    }
  }

  async getUserReports(query: PaginationDto) {
    const { page = 1, limit = 10 } = query;
    const reports = await this.prisma.report.findMany({
      select: {
        reported: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await this.prisma.report.count();
    return {
      success: true,
      message: 'User reports fetched successfully',
      data: reports,
      meta_data: {
        page,
        limit,
        total,
      },
    };
  }
}
