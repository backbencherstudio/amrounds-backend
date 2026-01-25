import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { GetAllUserDto } from './dto/query-user.dto';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
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
          address: true,
          type: true,
          approved_at: true,
          approved: true,
          rejected: true,
          created_at: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        data: users,
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
        },
      });
      await this.createActivity({
        title: 'User approved',
        description: `User ${user.name} has been approved`,
      });
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
        },
      });
      await this.createActivity({
        title: 'User rejected',
        description: `User ${user.name} has been rejected`,
      });
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
}
