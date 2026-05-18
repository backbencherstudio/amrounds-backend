import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  CreateQuestionDto,
  difficulty,
  topic,
} from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOneQuestion(
    id: string,
    createQuestionDto: CreateQuestionDto,
    explanation_image: Express.Multer.File,
    steam_image?: Express.Multer.File,
  ) {
    try {
      const { question_steam, answerOptions, explanation, ...rest } =
        createQuestionDto;

      let questionId = `Q-${StringHelper.randomNumber(7)}`;
      let isQuestionIdExist = await this.prisma.questions.findFirst({
        where: { question_id: questionId },
      });

      while (isQuestionIdExist) {
        questionId = `Q-${StringHelper.randomNumber(7)}`;
        isQuestionIdExist = await this.prisma.questions.findFirst({
          where: { question_id: questionId },
        });
      }

      let fileName: string | null = null;
      let finalExplanation = explanation;

      let steamFileName: string | null = null;
      let finalQuestionSteam = question_steam;

      if (steam_image) {
        try {
          steamFileName = `${StringHelper.randomString()}${steam_image.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.question + '/' + steamFileName,
            steam_image.buffer,
          );

          if (finalQuestionSteam) {
            finalQuestionSteam = finalQuestionSteam.replace(
              steam_image.originalname,
              steamFileName,
            );
          }
        } catch {
          throw new InternalServerErrorException('Failed to upload steam image');
        }
      }

      if (explanation_image) {
        try {
          fileName = `${StringHelper.randomString()}${explanation_image.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.question + '/' + fileName,
            explanation_image.buffer,
          );

          if (finalExplanation) {
            finalExplanation = finalExplanation.replace(
              explanation_image.originalname,
              fileName,
            );
          }
        } catch {
          throw new InternalServerErrorException('Failed to upload thumbnail');
        }
      }

      const newQuestion = await this.prisma.questions.create({
        data: {
          ...rest,
          question_steam: finalQuestionSteam,
          explanation: finalExplanation,
          user_id: id,
          question_id: questionId,
          explanation_image: fileName,
          steam_image: steamFileName,
          answerOptions: {
            create: answerOptions,
          },
        } as any,
      });
      return {
        success: true,
        message: 'Question created successfully',
      };
    } catch (error) {
      console.error(error);

      return {
        success: false,
        message: 'Failed to create question',
        error: error.message,
      };
    }
  }

  async findAllQuestions({
    page = 1,
    limit = 10,
    search,
  }: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    try {
      const skip = (page - 1) * limit;
      const take = limit;

      const where: any = {};

      if (search) {
        where.OR = [
          {
            question_steam: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            question_id: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            explanation: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            why_incorrect: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            pimping_point: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            memory_trick: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            referance: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ];

        // Check if search term matches any topic enum value
        const matchedTopics = Object.values(topic).filter((t) =>
          t.toLowerCase().includes(search.toLowerCase()),
        );

        if (matchedTopics.length > 0) {
          where.OR.push({
            topic: {
              hasSome: matchedTopics,
            },
          });
        }

        // Check if search term matches any difficulty enum value
        const matchedDifficulties = Object.values(difficulty).filter((d) =>
          d.toLowerCase().includes(search.toLowerCase()),
        );

        if (matchedDifficulties.length > 0) {
          where.OR.push({
            difficulty: {
              in: matchedDifficulties,
            },
          });
        }
      }

      const [questions, total] = await this.prisma.$transaction([
        this.prisma.questions.findMany({
          orderBy: {
            created_at: 'desc',
          },
          where,
          skip,
          take,
          select: {
            id: true,
            question_title: true,
            question_id: true,
            difficulty: true,
            topic: true,
          },
        }),
        this.prisma.questions.count({ where }),
      ]);

      const questionIds = questions.map((q) => q.id);

      const userAnswersGrouped = await this.prisma.userAnswer.groupBy({
        by: ['question_id', 'is_correct'],
        where: {
          question_id: {
            in: questionIds,
          },
        },
        _count: {
          _all: true,
        },
      });

      const questionsWithStats = questions.map((question) => {
        const stats = userAnswersGrouped.filter(
          (ua) => ua.question_id === question.id,
        );
        const totalAttempts = stats.reduce(
          (acc, curr) => acc + curr._count._all,
          0,
        );
        const correctAttempts =
          stats.find((ua) => ua.is_correct === true)?._count._all || 0;
        const correctPercentage =
          totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

        return {
          ...question,
          correct_percentage: parseFloat(correctPercentage.toFixed(2)),
          total_attempts: totalAttempts,
        };
      });

      const totalPage = Math.ceil(total / limit);
      const next = page < totalPage ? page + 1 : null;
      const previous = page > 1 ? page - 1 : null;

      return {
        success: true,
        message: 'Questions fetched successfully',
        data: questionsWithStats,
        meta: {
          total,
          page,
          limit,
          totalPage,
          next,
          previous,
        },
      };
    } catch (error) {
      console.log(error);
      return {
        success: false,
        message: 'Failed to fetch questions',
      };
    }
  }

  async findOneQuestion(id: string) {
    try {
      const question = await this.prisma.questions.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          question_id: true,
          question_steam: true,
          steam_image: true,
          question_title: true,
          difficulty: true,
          topic: true,
          answerOptions: {
            select: {
              id: true,
              option_text: true,
              is_correct: true,
            },
          },
          explanation: true,
          explanation_image: true,
          why_incorrect: true,
          pimping_point: true,
          memory_trick: true,
          referance: true,
        },
      });

      if (question && question.explanation) {
        question.explanation = question.explanation.replace(
          /\\(?=")|\\(?=\/)/g,
          '',
        );
      }

      if (question && question.question_steam) {
        question.question_steam = question.question_steam.replace(
          /\\(?=")|\\(?=\/)/g,
          '',
        );
      }

      let explanation_image_url = null;
      let steam_image_url = null;

      if (question && question.steam_image) {
        if (question.steam_image.startsWith('http')) {
          steam_image_url = question.steam_image;
        } else {
          steam_image_url = await SojebStorage.url(
            appConfig().storageUrl.question + '/' + question.steam_image,
          );
        }

        if (question.question_steam) {
          const escapedFileName = question.steam_image.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
          );
          const regex = new RegExp(
            `(src=['"])([^'"]*${escapedFileName})(['"])`,
            'g',
          );
          question.question_steam = question.question_steam.replace(
            regex,
            (match, p1, p2, p3) => {
              if (p2.startsWith('http')) {
                return match;
              }
              return `${p1}${steam_image_url}${p3}`;
            },
          );
        }
      }

      if (question && question.explanation_image) {
        if (question.explanation_image.startsWith('http')) {
          explanation_image_url = question.explanation_image;
        } else {
          explanation_image_url = await SojebStorage.url(
            appConfig().storageUrl.question + '/' + question.explanation_image,
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
        message: 'Question fetched successfully',
        data: {
          ...question,
          explanation_image_url,
          steam_image_url,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch question',
      };
    }
  }

  async updateOneQuestion(
    id: string,
    updateQuestionDto: UpdateQuestionDto,
    explanation_image: Express.Multer.File,
    steam_image?: Express.Multer.File,
  ) {
    try {
      const {
        question_title,
        question_steam,
        explanation,
        why_incorrect,
        pimping_point,
        memory_trick,
        referance,
        difficulty,
        topic,
        answerOptions,
      } = updateQuestionDto;

      const data: any = {};

      if (question_title) {
        data.question_title = question_title;
      }
      if (question_steam) {
        data.question_steam = question_steam;
      }
      if (explanation) {
        data.explanation = explanation;
      }
      if (why_incorrect) {
        data.why_incorrect = why_incorrect;
      }
      if (pimping_point) {
        data.pimping_point = pimping_point;
      }
      if (memory_trick) {
        data.memory_trick = memory_trick;
      }
      if (referance) {
        data.referance = referance;
      }
      if (difficulty) {
        data.difficulty = difficulty;
      }
      if (topic) {
        data.topic = topic;
      }
      if (answerOptions) {
        const existingOptions = await this.prisma.answerOptions.findMany({
          where: { question_id: id },
          select: { id: true },
        });

        const existingIds = existingOptions.map((o) => o.id);
        const incomingIds = answerOptions
          .filter((o) => o.id)
          .map((o) => o.id as string);

        const idsToDelete = existingIds.filter(
          (id) => !incomingIds.includes(id),
        );
        const optionsToCreate = answerOptions.filter((o) => !o.id);
        const optionsToUpdate = answerOptions.filter(
          (o) => o.id && existingIds.includes(o.id),
        );

        data.answerOptions = {
          deleteMany: {
            id: { in: idsToDelete },
          },
          create: optionsToCreate.map((o) => ({
            option_text: o.option_text,
            is_correct: o.is_correct,
          })),
          update: optionsToUpdate.map((o) => ({
            where: { id: o.id! },
            data: {
              option_text: o.option_text,
              is_correct: o.is_correct,
            },
          })),
        };
      }

      let fileName: string | null = null;
      let finalExplanation = explanation;

      let steamFileName: string | null = null;
      let finalQuestionSteam = question_steam;

      if (steam_image) {
        try {
          // get existing question
          const existingQuestion = await this.prisma.questions.findUnique({
            where: {
              id,
            },
          });

          // delete old file
          if (existingQuestion && existingQuestion.steam_image) {
            await SojebStorage.delete(
              appConfig().storageUrl.question +
                '/' +
                existingQuestion.steam_image,
            );
          }

          steamFileName = `${StringHelper.randomString()}${steam_image.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.question + '/' + steamFileName,
            steam_image.buffer,
          );

          if (!finalQuestionSteam && existingQuestion) {
            finalQuestionSteam = existingQuestion.question_steam;
          }

          let stringToReplace = steam_image.originalname;
          if (
            !question_steam &&
            existingQuestion &&
            existingQuestion.steam_image
          ) {
            stringToReplace = existingQuestion.steam_image;
          }

          if (finalQuestionSteam) {
            finalQuestionSteam = finalQuestionSteam.replace(
              stringToReplace,
              steamFileName,
            );
          }
        } catch {
          throw new InternalServerErrorException('Failed to upload steam image');
        }
      }

      if (explanation_image) {
        try {
          // get existing question
          const existingQuestion = await this.prisma.questions.findUnique({
            where: {
              id,
            },
          });

          // delete old file
          if (existingQuestion && existingQuestion.explanation_image) {
            await SojebStorage.delete(
              appConfig().storageUrl.question +
                '/' +
                existingQuestion.explanation_image,
            );
          }

          fileName = `${StringHelper.randomString()}${explanation_image.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.question + '/' + fileName,
            explanation_image.buffer,
          );

          if (!finalExplanation && existingQuestion) {
            finalExplanation = existingQuestion.explanation;
          }

          let stringToReplace = explanation_image.originalname;
          if (
            !explanation &&
            existingQuestion &&
            existingQuestion.explanation_image
          ) {
            stringToReplace = existingQuestion.explanation_image;
          }

          if (finalExplanation) {
            finalExplanation = finalExplanation.replace(
              stringToReplace,
              fileName,
            );
          }
        } catch {
          throw new InternalServerErrorException('Failed to upload thumbnail');
        }
      }

      if (fileName) {
        data.explanation_image = fileName;
      }
      if (finalExplanation) {
        data.explanation = finalExplanation;
      }

      if (steamFileName) {
        data.steam_image = steamFileName;
      }
      if (finalQuestionSteam) {
        data.question_steam = finalQuestionSteam;
      }

      const updatedQuestion = await this.prisma.questions.update({
        where: {
          id,
        },
        data: data as any,
      });
      return {
        success: true,
        message: 'Question updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update question',
      };
    }
  }

  async deleteOneQuestion(id: string) {
    try {
      const existingQuestion = await this.prisma.questions.findUnique({
        where: {
          id,
        },
      });

      if (existingQuestion && existingQuestion.explanation_image) {
        await SojebStorage.delete(
          appConfig().storageUrl.question +
            '/' +
            existingQuestion.explanation_image,
        );
      }

      if (existingQuestion && existingQuestion.steam_image) {
        await SojebStorage.delete(
          appConfig().storageUrl.question +
            '/' +
            existingQuestion.steam_image,
        );
      }

      await this.prisma.questions.delete({
        where: {
          id,
        },
      });
      return {
        success: true,
        message: 'Question deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete question',
      };
    }
  }
}
