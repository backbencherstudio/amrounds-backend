import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetLeaderboardDto } from './dto/query-leaderboard.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(userId: string, query: GetLeaderboardDto) {
    const { period = 'week', search, page = 1, limit = 10 } = query;

    let fromDate: Date;
    const now = new Date();
    if (period === 'week') {
      fromDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'month') {
      fromDate = new Date(now.setMonth(now.getMonth() - 1));
    } else if (period === 'year') {
      fromDate = new Date(now.setFullYear(now.getFullYear() - 1));
    } else {
      fromDate = new Date('2000-01-01');
    }

    const offset = (page - 1) * limit;
    const searchPattern = search ? `%${search}%` : null;

    const [leaderboardRows, [currentUserStatsRow], currentUserTrendsResult] =
      await Promise.all([
        this.prisma.$queryRaw<any[]>`
      WITH base_stats AS (
        SELECT
          user_id,
          COUNT(*)::int as total_tests,
          AVG(score)::float as avg_score
        FROM tests
        WHERE is_completed = true
        AND created_at >= ${fromDate}
        GROUP BY user_id
      ),
      ranked_users AS (
        SELECT
          user_id,
          total_tests,
          avg_score,
          RANK() OVER (ORDER BY avg_score DESC, total_tests DESC)::int as rank
        FROM base_stats
      )
      SELECT
        r.rank,
        r.user_id,
        r.total_tests,
        r.avg_score,
        u.name,
        u.avatar,
        u.current_practice as institution,
        (
          SELECT
            CASE WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(CASE WHEN is_correct = true THEN 1 END)::numeric / COUNT(*)) * 100)
            END
          FROM user_answers ua
          WHERE ua.user_id = r.user_id
          AND ua.created_at >= ${fromDate}
        )::int as accuracy
      FROM ranked_users r
      JOIN users u ON r.user_id = u.id
      WHERE 
        (${searchPattern}::text IS NULL OR u.name ILIKE ${searchPattern} OR u.current_practice ILIKE ${searchPattern})
      ORDER BY r.rank ASC
      LIMIT ${limit} OFFSET ${offset}
    `,
        this.prisma.$queryRaw<any[]>`
      WITH base_stats AS (
        SELECT
          user_id,
          COUNT(*)::int as total_tests,
          AVG(score)::float as avg_score
        FROM tests
        WHERE is_completed = true
        AND created_at >= ${fromDate}
        GROUP BY user_id
      ),
      ranked_users AS (
        SELECT
          user_id,
          total_tests,
          avg_score,
          RANK() OVER (ORDER BY avg_score DESC, total_tests DESC)::int as rank
        FROM base_stats
      )
      SELECT
        r.rank,
        r.total_tests,
        (
          SELECT
            CASE WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(CASE WHEN is_correct = true THEN 1 END)::numeric / COUNT(*)) * 100)
            END
          FROM user_answers ua
          WHERE ua.user_id = r.user_id
          AND ua.created_at >= ${fromDate}
        )::int as accuracy
      FROM ranked_users r
      WHERE r.user_id = ${userId}
    `,
        this.prisma.test.findMany({
          where: {
            user_id: userId,
            is_completed: true,
            created_at: { gte: fromDate },
          },
          orderBy: { created_at: 'desc' },
          take: 5,
          select: { score: true },
        }),
      ]);

    const userIds = leaderboardRows.map((r) => r.user_id);

    const trendsMap = new Map<string, number[]>();
    if (userIds.length > 0) {
      const trends = await this.prisma.test.findMany({
        where: {
          user_id: { in: userIds },
          is_completed: true,
          created_at: { gte: fromDate },
        },
        orderBy: { created_at: 'desc' },
        select: { user_id: true, score: true },
      });
      for (const t of trends) {
        if (!trendsMap.has(t.user_id)) trendsMap.set(t.user_id, []);
        const userTrend = trendsMap.get(t.user_id);
        if (userTrend && userTrend.length < 5) {
          userTrend.push(Math.round(t.score || 0));
        }
      }
    }

    const leaderboard = leaderboardRows.map((row) => ({
      rank: row.rank,
      user: {
        id: row.user_id,
        name: row.name,
        institution: row.institution,
        avatar: row.avatar
          ? SojebStorage.url(appConfig().storageUrl.avatar + '/' + row.avatar)
          : null,
      },
      tests_completed: row.total_tests,
      accuracy: row.accuracy || 0,
      avg_score: Math.round(row.avg_score || 0),
      trend: (trendsMap.get(row.user_id) || []).reverse(),
    }));

    const currentUserTrend = currentUserTrendsResult
      .map((t) => Math.round(t.score || 0))
      .reverse();

    const currentStreak = 0;

    return {
      success: true,
      data: {
        user_stats: currentUserStatsRow
          ? {
              rank: currentUserStatsRow.rank,
              tests_completed: currentUserStatsRow.total_tests,
              accuracy: currentUserStatsRow.accuracy || 0,
              current_streak: currentStreak,
              trend: currentUserTrend,
            }
          : null,
        leaderboard,
        meta: {
          page: +page,
          limit: +limit,
        },
      },
    };
  }

  async getMapData() {
    const groupedData = await this.prisma.user.groupBy({
      by: ['city', 'country'],
      where: {
        is_public: true,
        status: 1,
        type: 'user',
        city: { not: null },
        country: { not: null },
      },
      _count: {
        id: true,
      },
    });

    return {
      success: true,
      message: 'Map data retrieved successfully',
      data: groupedData.map((item) => ({
        city: item.city,
        country: item.country,
        count: item._count.id,
      })),
    };
  }
}
