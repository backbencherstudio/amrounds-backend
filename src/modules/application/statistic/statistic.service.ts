import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StatisticService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatistics(user_id: string) {
    const [
      testStatsResult,
      answerStatsResult,
      totalQuestions,
      topicStats,
      totalQuestionsByTopicRaw,
      topicRankRaw,
    ] = await Promise.all([
      this.prisma.$queryRaw<
        { avg_score: number | null; total: number; completed: number }[]
      >`
        SELECT
          AVG(CASE WHEN is_completed = true THEN score END)::float as avg_score,
          COUNT(*)::int as total,
          COUNT(CASE WHEN is_completed = true THEN 1 END)::int as completed
        FROM tests
        WHERE user_id = ${user_id}
      `,

      this.prisma.$queryRaw<
        {
          correct: number;
          incorrect: number;
          omitted: number;
          used_questions_count: number;
        }[]
      >`
        SELECT
          COUNT(CASE WHEN is_correct = true THEN 1 END)::int as correct,
          COUNT(CASE WHEN is_correct = false THEN 1 END)::int as incorrect,
          COUNT(CASE WHEN is_omitted = true THEN 1 END)::int as omitted,
          COUNT(DISTINCT question_id)::int as used_questions_count
        FROM user_answers
        WHERE user_id = ${user_id}
      `,

      this.prisma.questions.count(),

      this.prisma.$queryRaw<
        {
          topic: string;
          attempted: number;
          correct: number;
          used_questions: number;
        }[]
      >`
        SELECT
          t::text as topic,
          COUNT(*)::int as attempted,
          COUNT(CASE WHEN ua.is_correct = true THEN 1 END)::int as correct,
          COUNT(DISTINCT ua.question_id)::int as used_questions
        FROM user_answers ua
        JOIN questions q ON ua.question_id = q.id
        CROSS JOIN LATERAL unnest(q.topic) as t
        WHERE ua.user_id = ${user_id} AND ua.is_correct IS NOT NULL
        GROUP BY t
      `,

      this.prisma.$queryRaw<{ topic: string; total_questions: number }[]>`
        SELECT
          t::text as topic,
          COUNT(*)::int as total_questions
        FROM questions q
        CROSS JOIN LATERAL unnest(q.topic) as t
        GROUP BY t
      `,

      this.prisma.$queryRaw<{ topic: string; rank: number }[]>`
        SELECT topic, rank
        FROM (
          SELECT
            ua.user_id,
            t::text as topic,
            RANK() OVER (
              PARTITION BY t
              ORDER BY
                ROUND(
                  100.0 * COUNT(CASE WHEN ua.is_correct = true THEN 1 END)
                  / NULLIF(COUNT(*), 0),
                  2
                ) DESC
            )::int as rank
          FROM user_answers ua
          JOIN questions q ON ua.question_id = q.id
          CROSS JOIN LATERAL unnest(q.topic) as t
          WHERE ua.is_correct IS NOT NULL
          GROUP BY ua.user_id, t
        ) ranked
        WHERE user_id = ${user_id}
      `,
    ]);

    // Extract Test Stats
    const {
      avg_score: avgCorrectScore,
      total: totalTests,
      completed: completedTests,
    } = testStatsResult[0] || { avg_score: 0, total: 0, completed: 0 };

    // Extract Answer Stats
    const {
      correct: totalCorrectAnswered,
      incorrect: totalIncorrectAnswered,
      omitted: totalOmitted,
      used_questions_count: usedQuestions,
    } = answerStatsResult[0] || {
      correct: 0,
      incorrect: 0,
      omitted: 0,
      used_questions_count: 0,
    };



    const topicRankMap = new Map<string, number>(
      topicRankRaw.map((r) => [r.topic, r.rank]),
    );

    const unusedQuestions = Math.max(0, totalQuestions - usedQuestions);
    const questionBankProgress = totalQuestions
      ? +(100 * (usedQuestions / totalQuestions)).toFixed(2)
      : 0;

    const incompleteTests = Math.max(0, totalTests - completedTests);

    const topicStatsMap = new Map<string, (typeof topicStats)[number]>(
      topicStats.map((s) => [s.topic, s]),
    );

    const performanceByTopic = totalQuestionsByTopicRaw.map((topicData) => {
      const stats = topicStatsMap.get(topicData.topic) || {
        attempted: 0,
        correct: 0,
        used_questions: 0,
      };

      const percentage = stats.attempted
        ? +(100 * (stats.correct / stats.attempted)).toFixed(2)
        : 0;

      const totalQuestionsInTopic = topicData.total_questions;

      const progressPercentage = totalQuestionsInTopic
        ? +(100 * (stats.used_questions / totalQuestionsInTopic)).toFixed(2)
        : 0;

      return {
        topic: topicData.topic,
        correct_percentage: percentage,
        total_correct: stats.correct,
        rank: topicRankMap.get(topicData.topic) ?? null,
        question_bank_progress: progressPercentage,
      };
    });

    return {
      success: true,
      message: 'Statistics calculated successfully',
      data: {
        // performance
        performance: {
          correct_percentage_avg: +(+avgCorrectScore).toFixed(2) || 0,
          total_correct: totalCorrectAnswered || 0,
          total_incorrect: totalIncorrectAnswered || 0,
          total_omitted: totalOmitted || 0,
          // Removed global percentile_rank
        },

        // question bank progress
        question_bank: {
          total_questions: totalQuestions || 0,
          used_questions: usedQuestions || 0,
          unused_questions: unusedQuestions || 0,
          progress_percentage: questionBankProgress || 0,
        },

        // tests
        tests: {
          total: totalTests || 0,
          completed: completedTests || 0,
          incomplete: incompleteTests || 0,
        },

        // topic-wise performance
        performance_by_topic: performanceByTopic,
      },
    };
  }
}
