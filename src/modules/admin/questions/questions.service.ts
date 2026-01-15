import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateQuestionDto } from './dto/create-question.dto';
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
        data: newQuestion,
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        message: 'Failed to create questions',
      };
    }
  }

  async findAllQuestions() {
    try {
      const questions = await this.prisma.questions.findMany({
        select: {
          id: true,
          question_title: true,
          question_id: true,
          difficulty: true,
          topic: true,
        },
      });
      return {
        success: true,
        message: 'Questions fetched successfully',
        data: questions,
      };
    } catch (error) {
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
      });
      return {
        success: true,
        message: 'Question fetched successfully',
        data: question,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch question',
      };
    }
  }

  async update(id: string, updateQuestionDto: UpdateQuestionDto) {
    try {
      const updatedQuestion = await this.prisma.questions.update({
        where: {
          id,
        },
        data: updateQuestionDto as any,
      });
      return {
        success: true,
        message: 'Question updated successfully',
        data: updatedQuestion,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update question',
      };
    }
  }

  async remove(id: string) {
    try {
      const deletedQuestion = await this.prisma.questions.delete({
        where: {
          id,
        },
      });
      return {
        success: true,
        message: 'Question deleted successfully',
        data: deletedQuestion,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete question',
      };
    }
  }
}
