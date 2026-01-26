import { Injectable } from '@nestjs/common';
import { CreateTestDto, TestMode } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnswerTestDto } from './dto/answer-test.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { MarkQuestionDto } from './dto/mark-question.dto';
import { SkipQuestionDto } from './dto/skip-question.dto';
import { TestHistoryDto } from './dto/query-test.dto';

@Injectable()
export class TestService {
  constructor(private readonly prisma: PrismaService) {}

  async createOneTest(user_id: string, createTestDto: CreateTestDto) {
    try {
      const { total_questions, test_mode, difficulty, topic } = createTestDto;

      let orConditions: any[] = [];

      for (const mode of test_mode) {
        switch (mode) {
          case TestMode.USED:
            orConditions.push({ userAnswers: { some: { user_id: user_id } } });
            break;
          case TestMode.UNUSED:
            orConditions.push({ userAnswers: { none: { user_id: user_id } } });
            break;
          case TestMode.CORRECT:
            orConditions.push({
              userAnswers: {
                some: { user_id: user_id, is_correct: true },
              },
            });
            break;
          case TestMode.INCORRECT:
            orConditions.push({
              userAnswers: {
                some: { user_id: user_id, is_correct: false },
              },
            });
            break;
          case TestMode.OMITTED:
            orConditions.push({
              userAnswers: {
                some: { user_id: user_id, is_omitted: true },
              },
            });
            break;
          case TestMode.MARKED:
            orConditions.push({
              userAnswers: {
                some: { user_id: user_id, is_marked: true },
              },
            });
            break;
        }
      }

      const questionFilter: any = {
        difficulty: difficulty,
        topic: { hasSome: topic },
        AND: orConditions.length > 0 ? [{ OR: orConditions }] : [],
      };

      // Get all matching questions (fetching only IDs for performance)
      const matchingQuestions = await this.prisma.questions.findMany({
        where: questionFilter,
        select: { id: true },
      });

      if (matchingQuestions.length === 0) {
        throw new Error('No questions found matching the criteria');
      }

      // Shuffle and slice
      const shuffled = matchingQuestions.sort(() => 0.5 - Math.random());
      const selectedQuestionIds = shuffled
        .slice(0, total_questions)
        .map((q) => q.id);

      // Create the Test
      const test = await this.prisma.test.create({
        data: {
          user_id,
          test_mode: test_mode as any, // Cast to any to bypass Prisma type issue before generation
          difficulty,
          topic,
          total_questions: selectedQuestionIds.length,
          is_completed: false,
          questions: {
            connect: selectedQuestionIds.map((id) => ({ id })),
          },
        },
        select: {
          id: true,
          test_mode: true,
          total_questions: true,
          questions: {
            select: {
              id: true,
              question_steam: true,
              question_title: true,
              answerOptions: {
                select: {
                  id: true,
                  option_text: true,
                },
              },
            },
          },
        },
      });

      return {
        success: true,
        message: 'Test created successfully',
        data: test,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create test',
      };
    }
  }

  async answerTest(user_id: string, answerTestDto: AnswerTestDto) {
    try {
      const { test_id, question_id, answer_option_id } = answerTestDto;

      // Validate if the question belongs to the test
      const test = await this.prisma.test.findUnique({
        where: { id: test_id },
        include: {
          questions: {
            where: { id: question_id },
            select: { id: true },
          },
        },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      if (!test.questions || test.questions.length === 0) {
        throw new Error('Question does not belong to this test');
      }

      // Validate if the question is already answered
      const existingAnswer = await this.prisma.userAnswer.findFirst({
        where: {
          test_id: test_id,
          question_id: question_id,
        },
      });

      if (
        existingAnswer &&
        existingAnswer.selected_option_id &&
        existingAnswer.is_correct !== null
      ) {
        throw new Error('Question already answered in this test');
      }

      const selectedOption = await this.prisma.answerOptions.findUnique({
        where: { id: answer_option_id },
      });

      if (!selectedOption) {
        throw new Error('Answer option not found');
      }

      if (selectedOption.question_id !== question_id) {
        throw new Error('Answer option does not belong to this question');
      }

      const is_correct = selectedOption.is_correct ?? false;
      let userAnswer;

      if (existingAnswer) {
        // Update existing answer (was marked or omitted)
        userAnswer = await this.prisma.userAnswer.update({
          where: { id: existingAnswer.id },
          data: {
            selected_option_id: answer_option_id,
            is_correct: is_correct,
            is_omitted: false, // Reset omitted status if it was omitted
          },
        });
      } else {
        // Create new answer
        userAnswer = await this.prisma.userAnswer.create({
          data: {
            user_id,
            test_id,
            question_id,
            selected_option_id: answer_option_id,
            is_correct: is_correct,
          },
        });
      }

      const question = await this.prisma.questions.findUnique({
        where: { id: question_id },
        select: {
          id: true,
          question_steam: true,
          question_title: true,
          explanation: true,
          explanation_image: true,
          why_incorrect: true,
          pimping_point: true,
          memory_trick: true,
          referance: true,
          answerOptions: {
            select: {
              id: true,
              option_text: true,
            },
          },
        },
      });

      // Get answer statistics
      const answerStats = await this.prisma.userAnswer.groupBy({
        by: ['selected_option_id'],
        where: {
          question_id: question.id,
          selected_option_id: { not: null },
        },
        _count: {
          selected_option_id: true,
        },
      });

      const totalAnswers = answerStats.reduce(
        (sum, stat) => sum + stat._count.selected_option_id,
        0,
      );

      const statsMap = new Map(
        answerStats.map((stat) => [
          stat.selected_option_id,
          stat._count.selected_option_id,
        ]),
      );

      const answerOptionsWithStats = question.answerOptions.map((option) => {
        const count = statsMap.get(option.id) || 0;
        const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
        return {
          ...option,
          total_select: Math.round(percentage),
        };
      });

      let explanation_image_url = null;
      if (question && question.explanation_image) {
        if (question.explanation_image.startsWith('http')) {
          explanation_image_url = question.explanation_image;
        } else {
          explanation_image_url = SojebStorage.url(
            appConfig().storageUrl.question + question.explanation_image,
          );
        }

        if (question.explanation) {
          const escapedFileName = question.explanation_image.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
          );
          const regex = new RegExp(
            `(src=['"])([^'"]*${escapedFileName})(['"])`,
            'g',
          );
          question.explanation = question.explanation.replace(
            regex,
            (match, p1, p2, p3) => {
              if (p2.startsWith('http')) {
                return match;
              }
              return `${p1}${explanation_image_url}${p3}`;
            },
          );
        }
      }

      return {
        success: true,
        message: 'Answer submitted successfully',
        data: {
          is_correct,
          user_answer_id: userAnswer.id,
          explanation_image_url,
          ...question,
          answerOptions: answerOptionsWithStats,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to submit answers',
      };
    }
  }

  async markQuestion(user_id: string, markQuestionDto: MarkQuestionDto) {
    try {
      const { test_id, question_id, is_marked } = markQuestionDto;

      const test = await this.prisma.test.findUnique({
        where: { id: test_id },
        include: {
          questions: {
            where: { id: question_id },
            select: { id: true },
          },
        },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      if (!test.questions || test.questions.length === 0) {
        throw new Error('Question does not belong to this test');
      }

      const existingAnswer = await this.prisma.userAnswer.findFirst({
        where: {
          test_id: test_id,
          question_id: question_id,
        },
      });

      if (existingAnswer) {
        // If answer exists, update the is_marked status
        const updatedAnswer = await this.prisma.userAnswer.update({
          where: { id: existingAnswer.id },
          data: { is_marked },
        });

        return {
          success: true,
          message: 'Question marked status updated',
        };
      }

      // If no answer exists, create a new one
      const userAnswer = await this.prisma.userAnswer.create({
        data: {
          user_id,
          test_id,
          question_id,
          is_marked,
        },
      });

      return {
        success: true,
        message: 'Question marked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to mark question',
      };
    }
  }

  async skipQuestion(user_id: string, skipQuestionDto: SkipQuestionDto) {
    try {
      const { test_id, question_id } = skipQuestionDto;

      const test = await this.prisma.test.findUnique({
        where: { id: test_id },
        include: {
          questions: {
            where: { id: question_id },
            select: { id: true },
          },
        },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      if (!test.questions || test.questions.length === 0) {
        throw new Error('Question does not belong to this test');
      }

      const existingAnswer = await this.prisma.userAnswer.findFirst({
        where: {
          test_id: test_id,
          question_id: question_id,
        },
      });

      if (
        existingAnswer &&
        existingAnswer.selected_option_id &&
        existingAnswer.is_correct !== null
      ) {
        return {
          success: false,
          message: 'Question already answered, cannot be skipped',
        };
      }

      if (existingAnswer) {
        // If answer exists (but not fully answered), update to skipped
        const updatedAnswer = await this.prisma.userAnswer.update({
          where: { id: existingAnswer.id },
          data: { is_omitted: true },
        });

        return {
          success: true,
          message: 'Question skipped status updated',
        };
      }

      // If no answer exists, create a new one as skipped
      const userAnswer = await this.prisma.userAnswer.create({
        data: {
          user_id,
          test_id,
          question_id,
          is_omitted: true,
        },
      });

      return {
        success: true,
        message: 'Question skipped successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to skip question',
      };
    }
  }

  async completeTest(user_id: string, test_id: string) {
    try {
      const test = await this.prisma.test.findUnique({
        where: { id: test_id },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      // Calculate score based on answered questions only
      const answers = await this.prisma.userAnswer.findMany({
        where: {
          test_id: test_id,
          selected_option_id: { not: null },
          is_correct: { not: null },
        },
      });

      const totalAnswered = answers.length;
      const totalCorrect = answers.filter((a) => a.is_correct).length;
      const score =
        totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;

      const updatedTest = await this.prisma.test.update({
        where: { id: test_id },
        data: {
          is_completed: true,
          score: parseFloat(score.toFixed(2)),
        },
      });

      return {
        success: true,
        message: 'Test completed successfully',
        // data: {
        //   test_id,
        //   total_answered: totalAnswered,
        //   total_correct: totalCorrect,
        //   score: updatedTest.score,
        // },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to complete test',
      };
    }
  }

  async getTestResult(user_id: string, test_id: string) {
    try {
      const test = await this.prisma.test.findUnique({
        where: { id: test_id },
        include: {
          questions: {
            select: {
              id: true,
              topic: true,
            },
          },
          user_answers: true,
        },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      if (test.user_id !== user_id) {
        throw new Error('Test does not belong to this user');
      }

      if (!test.is_completed) {
        throw new Error('Test is not completed yet');
      }

      const totalQuestions = test.questions.length;
      let totalAnswered = 0;
      let totalCorrect = 0;
      let totalIncorrect = 0;

      // Topic-wise stats map
      const topicStats = new Map<
        string,
        { total: number; answered: number; correct: number; incorrect: number }
      >();

      const userAnswerMap = new Map(
        test.user_answers.map((ans) => [ans.question_id, ans]),
      );

      for (const question of test.questions) {
        const userAnswer = userAnswerMap.get(question.id);
        const isAnswered =
          userAnswer &&
          userAnswer.selected_option_id !== null &&
          userAnswer.is_correct !== null;
        const isCorrect = isAnswered ? userAnswer.is_correct : false;

        if (isAnswered) {
          totalAnswered++;
          if (isCorrect) {
            totalCorrect++;
          } else {
            totalIncorrect++;
          }
        }

        if (question.topic && question.topic.length > 0) {
          for (const topic of question.topic) {
            if (!topicStats.has(topic)) {
              topicStats.set(topic, {
                total: 0,
                answered: 0,
                correct: 0,
                incorrect: 0,
              });
            }

            const stats = topicStats.get(topic);
            stats.total++;
            if (isAnswered) {
              stats.answered++;
              if (isCorrect) {
                stats.correct++;
              } else {
                stats.incorrect++;
              }
            }
          }
        }
      }

      const topicWiseStats = Array.from(topicStats.entries()).map(
        ([topic, stats]) => {
          const percentage =
            stats.answered > 0 ? (stats.correct / stats.answered) * 100 : 0;
          return {
            topic,
            total_questions: stats.total,
            answered: stats.answered,
            correct: stats.correct,
            incorrect: stats.incorrect,
            percentage: parseFloat(percentage.toFixed(2)),
          };
        },
      );

      // Calculate used/unused stats
      const usedQuestions = await this.prisma.userAnswer.findMany({
        where: {
          user_id: user_id,
          question_id: { in: test.questions.map((q) => q.id) },
          test_id: { not: test_id },
        },
        distinct: ['question_id'],
        select: { id: true },
      });

      const usedCount = usedQuestions.length;
      const unusedCount = totalQuestions - usedCount;

      return {
        success: true,
        message: 'Test result retrieved successfully',
        data: {
          test_id,
          difficulty: test.difficulty,
          total_questions: totalQuestions,
          total_answered: totalAnswered,
          total_correct: totalCorrect,
          total_incorrect: totalIncorrect,
          used_questions: usedCount,
          unused_questions: unusedCount,
          score: test.score || 0,
          topic_wise_stats: topicWiseStats,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve test result',
      };
    }
  }

  async getTestHistories(user_id: string, query: TestHistoryDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;
    const tests = await this.prisma.test.findMany({
      where: {
        user_id,
      },
      select: {
        id: true,
        created_at: true,
        test_mode: true,
        difficulty: true,
        topic: true,
        total_questions: true,
        score: true,
        is_completed: true,
      },
      skip,
      take: limit,
    });

    return {
      success: true,
      message: 'Test history retrieved successfully',
      data: tests || [],
      meta_data: {
        page,
        limit,
        total: tests?.length || 0,
      },
    };
  }
}
