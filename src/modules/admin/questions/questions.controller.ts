import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Request } from 'express';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@ApiBearerAuth()
@ApiTags('Help')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN)
@Controller('admin/questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'explanation_image', maxCount: 1 },
        { name: 'steam_image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: {
        fileSize: 15 * 1024 * 1024,
        fieldSize: 15 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  createOneQuestion(
    @Req() req: Request,
    @Body() createQuestionDto: CreateQuestionDto,
    @UploadedFiles()
    files: {
      explanation_image?: Express.Multer.File[];
      steam_image?: Express.Multer.File[];
    },
  ) {
    const userId = req.user.userId;
    const explanation_image = files?.explanation_image?.[0];
    const steam_image = files?.steam_image?.[0];

    return this.questionsService.createOneQuestion(
      userId,
      createQuestionDto,
      explanation_image,
      steam_image,
    );
  }

  @Get()
  findAllQuestions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.questionsService.findAllQuestions({
      page: Number(page),
      limit: Number(limit),
      search,
    });
  }

  @Get(':id')
  findOneQuestion(@Param('id') id: string) {
    return this.questionsService.findOneQuestion(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'explanation_image', maxCount: 1 },
        { name: 'steam_image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: {
        fileSize: 10 * 1024 * 1024,
        fieldSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  updateOneQuestion(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
    @UploadedFiles()
    files: {
      explanation_image?: Express.Multer.File[];
      steam_image?: Express.Multer.File[];
    },
  ) {
    const explanation_image = files?.explanation_image?.[0];
    const steam_image = files?.steam_image?.[0];

    return this.questionsService.updateOneQuestion(
      id,
      updateQuestionDto,
      explanation_image,
      steam_image,
    );
  }

  @Delete(':id')
  deleteOneQuestion(@Param('id') id: string) {
    return this.questionsService.deleteOneQuestion(id);
  }
}
