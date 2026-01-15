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
  ) {
    try {
      const { question_steam, answerOptions, explanation, ...rest } =
        createQuestionDto;

      let questionId = `Q-${StringHelper.randomNumber(7)}`;
      let isQuestionIdExist = await this.prisma.questions.findFirst({
        where: { question_id: questionId },
      });

      while (isQuestionIdExist) {
        questionId = `Q-${StringHelper.randomNumber(8)}`;
        isQuestionIdExist = await this.prisma.questions.findFirst({
          where: { question_id: questionId },
        });
      }

      let fileName: string | null = null;
      let finalExplanation = explanation;

      if (explanation_image) {
        try {
          fileName = `${StringHelper.randomString()}${explanation_image.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.question + fileName,
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
          question_steam: question_steam,
          explanation: finalExplanation,
          user_id: id,
          question_id: questionId,
          explanation_image: fileName,
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
            question_title: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ];

        // Check if search term matches any topic enum value
        if (Object.values(topic).includes(search as topic)) {
          where.OR.push({
            topic: {
              has: search as topic,
            },
          });
        }

        // Check if search term matches any difficulty enum value
        if (Object.values(difficulty).includes(search as difficulty)) {
          where.OR.push({
            difficulty: {
              equals: search as difficulty,
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

      const totalPage = Math.ceil(total / limit);
      const next = page < totalPage ? page + 1 : null;
      const previous = page > 1 ? page - 1 : null;

      return {
        success: true,
        message: 'Questions fetched successfully',
        data: questions,
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

      let explanation_image_url = null;
      if (question && question.explanation_image) {
        explanation_image_url = SojebStorage.url(
          appConfig().storageUrl.question + question.explanation_image,
        );

        if (question.explanation) {
          question.explanation = question.explanation.replace(
            question.explanation_image,
            explanation_image_url,
          );
        }
      }

      return {
        success: true,
        message: 'Question fetched successfully',
        data: {
          ...question,
          explanation_image_url,
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
        data.answerOptions = {
          deleteMany: {},
          create: answerOptions,
        };
      }

      let fileName: string | null = null;
      let finalExplanation = explanation;

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
                existingQuestion.explanation_image,
            );
          }

          fileName = `${StringHelper.randomString()}${explanation_image.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.question + fileName,
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
      const deletedQuestion = await this.prisma.questions.delete({
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
