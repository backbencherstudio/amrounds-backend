import { Injectable } from '@nestjs/common';
import { CreateTestDto, TestMode } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnswerTestDto } from './dto/answer-test.dto';

@Injectable()
export class TestService {
  constructor(private readonly prisma: PrismaService) {}

  async createOneTest(user_id: string, createTestDto: CreateTestDto) {
    try {
      const { total_questions, test_mode, difficulty, topic } = createTestDto;

      let questionFilter: any = {
        difficulty: difficulty,
        topic: { hasSome: topic },
      };

      switch (test_mode) {
        case TestMode.USED:
          questionFilter.userAnswers = { some: { user_id: user_id } };
          break;
        case TestMode.UNUSED:
          questionFilter.userAnswers = { none: { user_id: user_id } };
          break;
        case TestMode.CORRECT:
          questionFilter.userAnswers = {
            some: { user_id: user_id, is_correct: true },
          };
          break;
        case TestMode.INCORRECT:
          questionFilter.userAnswers = {
            some: { user_id: user_id, is_correct: false },
          };
          break;
        case TestMode.OMITTED:
          questionFilter.userAnswers = {
            some: { user_id: user_id, is_omitted: true },
          };
          break;
        case TestMode.MARKED:
          questionFilter.userAnswers = {
            some: { user_id: user_id, is_marked: true },
          };
          break;
      }

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
          test_mode,
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

      if (existingAnswer) {
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

      const userAnswer = await this.prisma.userAnswer.create({
        data: {
          user_id,
          test_id,
          question_id,
          selected_option_id: answer_option_id,
          is_correct: is_correct,
        },
      });

      const question = await this.prisma.questions.findUnique({
        where: { id: question_id },
        select: {
          explanation: true,
          explanation_image: true,
          why_incorrect: true,
          pimping_point: true,
          memory_trick: true,
          referance: true,
        },
      });

      return {
        success: true,
        message: 'Answer submitted successfully',
        data: {
          is_correct,
          user_answer_id: userAnswer.id,
          ...question,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to submit answers',
      };
    }
  }
}
