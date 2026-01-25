import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetActivitiesQueryDto } from './dto/query-overview.dto';

@Injectable()
export class OverviewService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [totalUsers, pendingUserVerification, totalQuestions, totalTests] =
      await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.user.count({
          where: {
            approved_at: null,
            approved: false,
            rejected: false,
          },
        }),
        this.prisma.questions.count(),
        this.prisma.test.count(),
      ]);

    return {
      success: true,
      message: 'Stats fetched successfully',
      data: {
        total_users: totalUsers,
        pending_user_verification: pendingUserVerification,
        total_questions: totalQuestions,
        total_tests: totalTests,
      },
    };
  }

  async getActivities(query: GetActivitiesQueryDto) {
    const { page = 1, limit = 10 } = query;

    const [activities, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          created_at: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activity.count(),
    ]);

    return {
      success: true,
      message: 'Activities fetched successfully',
      data: activities,
      meta_data: {
        page,
        limit,
        total,
      },
    };
  }
}
