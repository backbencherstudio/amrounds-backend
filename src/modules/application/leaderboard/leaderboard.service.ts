import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetLeaderboardDto } from './dto/query-leaderboard.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(userId: string, query: GetLeaderboardDto) {
    let { period = 'week', search, page = 1, limit = 10, filter } = query;

    // Apply Filter presets
    if (filter === 'top_10') {
      limit = 10;
      page = 1;
    }

    // 1. Calculate Date Filter
    let fromDate: Date;
    const now = new Date();
    if (period === 'week') {
      fromDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'month') {
      fromDate = new Date(now.setMonth(now.getMonth() - 1));
    } else if (period === 'year') {
      fromDate = new Date(now.setFullYear(now.getFullYear() - 1));
    } else {
      // 'all' - set to a very old date
      fromDate = new Date('2000-01-01');
    }

    const offset = (page - 1) * limit;
    const searchPattern = search ? `%${search}%` : null;

    // Filter Conditions
    let havingClause = '';
    if (filter === 'high_accuracy') {
      havingClause = 'AND accuracy >= 70';
    } else if (filter === 'active_users') {
      havingClause = 'AND total_tests >= 50';
    }

    // 2. Fetch Leaderboard (Raw SQL) & Current User Stats (Parallel)
    // We construct a reusable stats CTE part
    const statsQuery = (forUser?: string) => `
      WITH base_stats AS (
        SELECT
          t.user_id,
          COUNT(*)::int as total_tests,
          AVG(t.score)::float as avg_score
        FROM tests t
        WHERE t.is_completed = true
        AND t.created_at >= '${fromDate.toISOString()}'
        GROUP BY t.user_id
      ),
      user_accuracies AS (
        SELECT 
           ua.user_id,
           CASE WHEN COUNT(*) = 0 THEN 0
           ELSE ROUND((COUNT(CASE WHEN ua.is_correct = true THEN 1 END)::numeric / COUNT(*)) * 100)
           END::int as accuracy
        FROM user_answers ua
        WHERE ua.created_at >= '${fromDate.toISOString()}'
        GROUP BY ua.user_id
        ${forUser ? `HAVING ua.user_id = '${forUser}'` : ''} 
      ),
      combined_stats AS (
        SELECT 
          b.user_id,
          b.total_tests,
          b.avg_score,
          COALESCE(a.accuracy, 0) as accuracy
        FROM base_stats b
        LEFT JOIN user_accuracies a ON b.user_id = a.user_id
      ),
      ranked_users AS (
        SELECT
          user_id,
          total_tests,
          avg_score,
          accuracy,
          RANK() OVER (ORDER BY avg_score DESC, total_tests DESC)::int as rank
        FROM combined_stats
        WHERE 1=1 ${havingClause}
      )
    `;

    const [leaderboardRows, [currentUserStatsRow], currentUserTrendsResult] =
      await Promise.all([
        this.prisma.$queryRawUnsafe<any[]>(
          `
      ${statsQuery()}
      SELECT
        r.rank,
        r.user_id,
        r.total_tests,
        r.avg_score,
        r.accuracy,
        u.name,
        u.avatar,
        u.current_practice as institution
      FROM ranked_users r
      JOIN users u ON r.user_id = u.id
      WHERE 
        ($1::text IS NULL OR u.name ILIKE $1 OR u.current_practice ILIKE $1)
      ORDER BY r.rank ASC
      LIMIT $2 OFFSET $3
    `,
          searchPattern,
          limit,
          offset,
        ),

        // Current User Stats - We want their global rank, so we execute similar query but select specific user
        this.prisma.$queryRawUnsafe<any[]>(
          `
      ${statsQuery()}
      SELECT
        r.rank,
        r.total_tests,
        r.accuracy
      FROM ranked_users r
      WHERE r.user_id = $1
    `,
          userId,
        ),

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
