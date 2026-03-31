import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TestService } from './test.service';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { AnswerTestDto } from './dto/answer-test.dto';
import { MarkQuestionDto } from './dto/mark-question.dto';
import { SkipQuestionDto } from './dto/skip-question.dto';
import { TestHistoryDto } from './dto/query-test.dto';

@ApiBearerAuth()
@ApiTags('Test')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Post()
  createOneTest(@Req() req: Request, @Body() createTestDto: CreateTestDto) {
    const user_id = req.user.userId;
    return this.testService.createOneTest(user_id, createTestDto);
  }

  @Post('answer')
  answerTest(@Req() req: Request, @Body() answerTestDto: AnswerTestDto) {
    const user_id = req.user.userId;
    return this.testService.answerTest(user_id, answerTestDto);
  }

  @Post('mark-toggle')
  markQuestion(@Req() req: Request, @Body() markQuestionDto: MarkQuestionDto) {
    const user_id = req.user.userId;
    return this.testService.markQuestion(user_id, markQuestionDto);
  }

  @Post('skip')
  skipQuestion(@Req() req: Request, @Body() skipQuestionDto: SkipQuestionDto) {
    const user_id = req.user.userId;
    return this.testService.skipQuestion(user_id, skipQuestionDto);
  }

  @Patch('complete')
  completeTest(@Req() req: Request, @Query('test_id') test_id: string) {
    const user_id = req.user.userId;
    return this.testService.completeTest(user_id, test_id);
  }

  @Get('result')
  getTestResult(@Req() req: Request, @Query('test_id') test_id: string) {
    const user_id = req.user.userId;
    return this.testService.getTestResult(user_id, test_id);
  }

  @Get('histories')
  getTestHistories(@Req() req: Request, @Query() query: TestHistoryDto) {
    const user_id = req.user.userId;
    return this.testService.getTestHistories(user_id, query);
  }

  @Get('histories-stats')
  getTestHistoriesStats(@Req() req: Request) {
    const user_id = req.user.userId;
    return this.testService.getTestHistoriesStats(user_id);
  }

  @Get('question-count')
  getQuestionCount(@Req() req: Request) {
    const user_id = req.user.userId;
    return this.testService.getQuestionCount(user_id);
  }

  @Get('details/:id')
  getTestDetails(@Req() req: Request, @Param('id') id: string) {
    const user_id = req.user.userId;
    return this.testService.getTestDetails(user_id, id);
  }
}
