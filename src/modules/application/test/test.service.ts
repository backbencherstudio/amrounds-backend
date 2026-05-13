import { Injectable } from '@nestjs/common';
import { CreateTestDto, TestMode } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnswerTestDto } from './dto/answer-test.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { MarkQuestionDto } from './dto/mark-question.dto';
import { SkipQuestionDto } from './dto/skip-question.dto';
import { PaginationDto, TestHistoryDto } from './dto/query-test.dto';

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
        difficulty: { in: difficulty },
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

  async getOneTest(user_id: string, test_id: string) {
    try {
      const test = await this.prisma.test.findUnique({
        where: { id: test_id },
        include: {
          questions: {
            select: {
              id: true,
              question_id: true,
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
                  is_correct: true,
                },
              },
            },
          },
          user_answers: {
            where: {
              test_id: test_id,
              user_id: user_id,
            },
            select: {
              id: true,
              question_id: true,
              selected_option_id: true,
              is_marked: true,
            },
          },
        },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      test.questions = await Promise.all(
        test.questions.map(async (question: any) => {
          if (question && question.explanation) {
            question.explanation = question.explanation.replace(
              /\\(?=")|\\(?=\/)/g,
              '',
            );
          }

          let explanation_image_url = null;
          if (question && question.explanation_image) {
            if (question.explanation_image.startsWith('http')) {
              explanation_image_url = question.explanation_image;
            } else {
              explanation_image_url = await SojebStorage.url(
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
            ...question,
            explanation_image_url,
          };
        }),
      ) as any;

      return {
        success: true,
        message: 'Test fetched successfully',
        data: test,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch test',
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
              is_correct: true,
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
          explanation_image_url = await SojebStorage.url(
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
          selected_option_id: userAnswer.selected_option_id,
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

  async getMarkQuestions(user_id: string) {
    try {
      const test = await this.prisma.userAnswer.findMany({
        where: {
          user_id: user_id,
          is_marked: true,
        },
        select: {
          id: true,
          created_at: true,
          test_id: true,
          is_marked: true,
          question: {
            select: {
              id: true,
              question_steam: true,
              answerOptions: { select: { id: true, option_text: true } },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      return {
        success: true,
        message: 'Question marked status updated',
        data: test,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to mark question',
      };
    }
  }

  async getOngoingTests(user_id: string, query: PaginationDto) {
    try {
      const { page, limit } = query;
      const skip = (page - 1) * limit;
      const take = limit;
      const test = await this.prisma.test.findMany({
        where: {
          user_id: user_id,
          is_completed: false,
          score: null,
        },
        select: {
          id: true,
          created_at: true,
          is_completed: true,
          difficulty: true,
          topic: true,
          test_mode: true,
          total_questions: true,
        },
        skip,
        take,
        orderBy: {
          created_at: 'desc',
        },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      const total = await this.prisma.test.count({
        where: {
          user_id: user_id,
          is_completed: false,
          score: null,
        },
      });
      return {
        success: true,
        message: 'Test found successfully',
        data: test,
        metadata: {
          page,
          limit,
          total,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get test',
      };
    }
  }

  async getQuestionsByTestId(user_id: string, test_id: string) {
    try {
      const test = await this.prisma.test.findUnique({
        where: { id: test_id },
        include: {
          questions: {
            select: {
              id: true,
              question_steam: true,
              answerOptions: { select: { id: true, option_text: true } },
            },
          },
        },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      return {
        success: true,
        message: 'Questions found successfully',
        data: test,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get questions',
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
              difficulty: true,
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

      // Difficulty-wise stats map
      const difficultyStats = new Map<
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

        if (question.difficulty) {
          if (!difficultyStats.has(question.difficulty)) {
            difficultyStats.set(question.difficulty, {
              total: 0,
              answered: 0,
              correct: 0,
              incorrect: 0,
            });
          }

          const stats = difficultyStats.get(question.difficulty);
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

      const difficultyWiseStats = Array.from(difficultyStats.entries()).map(
        ([difficulty, stats]) => {
          const percentage =
            stats.answered > 0 ? (stats.correct / stats.answered) * 100 : 0;
          return {
            difficulty,
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
          difficulty_wise_stats: difficultyWiseStats,
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

    const whereCondition: any = {
      user_id,
    };

    if (search) {
      const searchUpper = search.toUpperCase();
      whereCondition.OR = [];

      const validModes = [
        'USED',
        'UNUSED',
        'CORRECT',
        'INCORRECT',
        'OMITTED',
        'MARKED',
      ];
      const matchedMode = validModes.find(
        (m) => m.toUpperCase() === searchUpper,
      );
      if (matchedMode) {
        whereCondition.OR.push({ test_mode: { has: matchedMode } });
      } else {
        whereCondition.OR.push({ test_mode: { has: search } });
      }

      const validDifficulties = ['Intern', 'Board', 'Senior'];
      const matchedDiff = validDifficulties.find(
        (d) => d.toUpperCase() === searchUpper,
      );
      if (matchedDiff) {
        whereCondition.OR.push({ difficulty: { has: matchedDiff } });
      }

      const validTopics = [
        'Anesthesia_Medicine',
        'Cancer',
        'Cleft_Craniofacial',
        'Cosmetics',
        'Dentoalveolar',
        'Implants',
        'Orthognathic',
        'Pathology',
        'Recontraction',
        'TMJ',
        'Trauma',
      ];
      const matchedTopic = validTopics.find(
        (t) => t.toUpperCase() === searchUpper,
      );
      if (matchedTopic) {
        whereCondition.OR.push({ topic: { has: matchedTopic } });
      }

      // If none matched enums and we pushed only the raw search to test_mode,
      // and it didn't match anything, it will return an empty array, which is standard.
    }

    const tests = await this.prisma.test.findMany({
      where: whereCondition,
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
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
    });

    const total = await this.prisma.test.count({
      where: whereCondition,
    });

    return {
      success: true,
      message: 'Test history retrieved successfully',
      data: tests || [],
      meta_data: {
        page,
        limit,
        total: total || 0,
      },
    };
  }

  async getTestHistoriesStats(user_id: string) {
    const [
      totalTests,
      completedTests,
      {
        _sum: { score: scoreSum },
      },
      {
        _max: { score: bestScore },
      },
      {
        _sum: { total_questions: totalQuestions },
      },
      {
        _sum: { score: lastWeekScore },
      },
      {
        _sum: { score: thisWeekScore },
      },
    ] = await Promise.all([
      this.prisma.test.count({
        where: {
          user_id,
        },
      }),
      this.prisma.test.count({
        where: {
          user_id,
          is_completed: true,
        },
      }),
      this.prisma.test.aggregate({
        where: {
          user_id,
          is_completed: true,
        },
        _sum: {
          score: true,
        },
      }),
      this.prisma.test.aggregate({
        where: {
          user_id,
          is_completed: true,
        },
        _max: {
          score: true,
        },
      }),
      this.prisma.test.aggregate({
        where: {
          user_id,
          is_completed: true,
        },
        _sum: {
          total_questions: true,
        },
      }),
      this.prisma.test.aggregate({
        where: {
          user_id,
          is_completed: true,
          created_at: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        _sum: {
          score: true,
        },
      }),
      this.prisma.test.aggregate({
        where: {
          user_id,
          is_completed: true,
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        _sum: {
          score: true,
        },
      }),
    ]);

    const comparisonScore = thisWeekScore - lastWeekScore || 0;
    return {
      success: true,
      message: 'Test history stats retrieved successfully',
      data: {
        total_tests: totalTests || 0,
        completed_tests: completedTests || 0,
        average_score: +(scoreSum / (completedTests || 1)).toFixed(2) || 0,
        best_score: +bestScore?.toFixed(2) || 0,
        comparison_score: +comparisonScore.toFixed(2) || 0,
        total_questions: totalQuestions || 0,
      },
    };
  }

  async getQuestionCount(user_id: string) {
    try {
      const allQuestionsInfo = await this.prisma.questions.findMany({
        where: { deleted_at: null },
        select: { id: true, difficulty: true, topic: true },
      });
      const totalQuestions = allQuestionsInfo.length;

      const difficultyStats: Record<string, number> = {};
      const topicStats: Record<string, number> = {};

      allQuestionsInfo.forEach((q) => {
        if (q.difficulty) {
          difficultyStats[q.difficulty] =
            (difficultyStats[q.difficulty] || 0) + 1;
        }
        if (q.topic && Array.isArray(q.topic)) {
          q.topic.forEach((t) => {
            topicStats[t] = (topicStats[t] || 0) + 1;
          });
        }
      });

      const difficulty_wise_count = Object.entries(difficultyStats).map(
        ([name, count]) => ({ name, count }),
      );
      const topic_wise_count = Object.entries(topicStats).map(
        ([name, count]) => ({ name, count }),
      );

      const usedQuestions = await this.prisma.userAnswer.findMany({
        where: { user_id },
        distinct: ['question_id'],
        select: { id: true },
      });
      const usedCount = usedQuestions.length;

      const unusedCount = totalQuestions - usedCount;

      const correctQuestions = await this.prisma.userAnswer.findMany({
        where: { user_id, is_correct: true },
        distinct: ['question_id'],
        select: { id: true },
      });
      const correctCount = correctQuestions.length;

      const incorrectQuestions = await this.prisma.userAnswer.findMany({
        where: { user_id, is_correct: false },
        distinct: ['question_id'],
        select: { id: true },
      });
      const incorrectCount = incorrectQuestions.length;

      const markedQuestions = await this.prisma.userAnswer.findMany({
        where: { user_id, is_marked: true },
        distinct: ['question_id'],
        select: { id: true },
      });
      const markCount = markedQuestions.length;

      return {
        success: true,
        message: 'Question count retrieved successfully',
        data: {
          total_questions: totalQuestions,
          used_questions: usedCount,
          unused_questions: unusedCount,
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          mark_count: markCount,
          difficulty_wise_count,
          topic_wise_count,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve question count',
      };
    }
  }

  async getTestDetails(user_id: string, test_id: string) {
    try {
      const test = await this.prisma.test.findUnique({
        where: {
          id: test_id,
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
          questions: {
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
                  is_correct: true,
                },
              },
              topic: true,
              difficulty: true,
            },
          },
          user_answers: {
            select: {
              question_id: true,
              selected_option_id: true,
            },
          },
        },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      // 1. Map user's selected options
      const userAnswerMap = new Map<string, string>();
      test.user_answers.forEach((ans) => {
        if (ans.selected_option_id) {
          userAnswerMap.set(ans.question_id, ans.selected_option_id);
        }
      });

      // 2. Get Statistics for all questions in this test
      const questionIds = test.questions.map((q) => q.id);

      const answerStats = await this.prisma.userAnswer.groupBy({
        by: ['question_id', 'selected_option_id'],
        where: {
          question_id: { in: questionIds },
          selected_option_id: { not: null },
        },
        _count: {
          selected_option_id: true,
        },
      });

      // Process stats: Calculate total answers per question
      const questionTotalAnswers = new Map<string, number>();
      const optionCounts = new Map<string, number>();

      answerStats.forEach((stat) => {
        const qId = stat.question_id;
        const oId = stat.selected_option_id;
        const count = stat._count.selected_option_id;

        const currentTotal = questionTotalAnswers.get(qId) || 0;
        questionTotalAnswers.set(qId, currentTotal + count);

        optionCounts.set(oId!, count);
      });

      // 3. Merge data
      const questionsWithDetails = await Promise.all(
        test.questions.map(async (question) => {
          const totalAnswersForQuestion =
            questionTotalAnswers.get(question.id) || 0;

          const answerOptionsWithStats = question.answerOptions.map((option) => {
            const count = optionCounts.get(option.id) || 0;
            const percentage =
              totalAnswersForQuestion > 0
                ? (count / totalAnswersForQuestion) * 100
                : 0;
            return {
              ...option,
              total_select: Math.round(percentage),
            };
          });

          let explanation_image_url = null;
          let processedExplanation = question.explanation;

          if (question.explanation_image) {
            if (question.explanation_image.startsWith('http')) {
              explanation_image_url = question.explanation_image;
            } else {
              explanation_image_url = await SojebStorage.url(
                appConfig().storageUrl.question + question.explanation_image,
              );
            }

            if (processedExplanation) {
              const escapedFileName = question.explanation_image.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&',
              );
              const regex = new RegExp(
                `(src=['"])([^'"]*${escapedFileName})(['"])`,
                'g',
              );
              processedExplanation = processedExplanation.replace(
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
            ...question,
            explanation: processedExplanation,
            explanation_image_url,
            answerOptions: answerOptionsWithStats,
            user_selected_option_id: userAnswerMap.get(question.id) || null,
          };
        }),
      );

      // Construct final response, excluding the raw user_answers array if desired,
      // but we need to return the modified questions array.
      // We'll return a new object spreading the test properties but replacing questions.

      const { questions, user_answers, ...testDetails } = test;

      return {
        success: true,
        message: 'Test details retrieved successfully',
        data: {
          ...testDetails,
          questions: questionsWithDetails,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve test details',
      };
    }
  }
}
