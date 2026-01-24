import { Injectable } from '@nestjs/common';
import { CreateHelpDto } from './dto/create-help.dto';
import { UpdateHelpDto } from './dto/update-help.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class HelpService {
  constructor(private readonly prisma: PrismaService) {}

  // Create update delete privacy policy, disclaimer terms
  async createSupport(id: string, createHelpDto: CreateHelpDto) {
    try {
      const support = await this.prisma.support.findFirst({
        where: {
          user_id: id,
        },
      });

      if (support) {
        // If support exists, update it with provided fields
        const updatedSupport = await this.prisma.support.update({
          where: {
            id: support.id,
          },
          data: createHelpDto,
        });
        return {
          success: true,
          message: 'Help and support updated successfully',
        };
      } else {
        // If support doesn't exist, create it
        const newSupport = await this.prisma.support.create({
          data: {
            ...createHelpDto,
            user_id: id,
          },
        });
        return {
          success: true,
          message: 'Help and support created successfully',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update help and support',
      };
    }
  }

  async findAllSupport() {
    try {
      const support = await this.prisma.support.findMany({
        select: {
          id: true,
          created_at: true,
          privacy_policy: true,
          disclaimer: true,
          terms_of_conditions: true,
        },
      });
      return {
        success: true,
        message: 'Help and support data fetched successfully',
        data: support,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get help and support data',
      };
    }
  }

  async deleteSupport(id: string) {
    try {
      const deleteSupport = await this.prisma.support.delete({
        where: { id },
      });
      return {
        success: true,
        message: 'Delete terms and support successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete terms and support',
      };
    }
  }
}
