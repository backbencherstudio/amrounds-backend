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
}
