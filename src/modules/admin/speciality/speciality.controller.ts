import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { SpecialityService } from './speciality.service';
import { CreateSpecialityDto } from './dto/create-speciality.dto';
import {
  AddTopicDto,
  UpdateSpecialityDto,
  UpdateTopicDto,
} from './dto/update-speciality.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Role } from 'src/common/guard/role/role.enum';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@ApiBearerAuth()
@ApiTags('Admin Speciality')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN)
@Controller('admin/speciality')
export class SpecialityController {
  constructor(private readonly specialityService: SpecialityService) { }

  @ApiOperation({
    summary: 'Create a new speciality with cover image and multiple topics with images',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'Cardiology',
          description: 'Speciality name',
        },
        is_active: {
          type: 'boolean',
          default: true,
          description: 'Whether the speciality is active',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Cover image file for the speciality',
        },
        topics: {
          type: 'string',
          description:
            'JSON array string of topics, e.g. [{"name": "Heart Failure", "is_active": true}]',
          example:
            '[{"name": "Heart Failure", "is_active": true}, {"name": "Arrhythmia", "is_active": true}]',
        },
        topic_images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description:
            'Topic image files uploaded in the same order as topics or named by index (e.g. topic_image_0, topics[0][image])',
        },
      },
      required: ['name'],
    },
  })
  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024, // 15MB per file
        fieldSize: 50 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml)$/i)) {
          return cb(
            new BadRequestException(
              `File "${file.originalname}" is not an allowed image format (jpg, jpeg, png, gif, webp, svg)`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  create(
    @Body() createSpecialityDto: CreateSpecialityDto,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    return this.specialityService.create(createSpecialityDto, files);
  }

  @ApiOperation({ summary: 'Get all specialities' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('is_active') is_active?: string | boolean,
  ) {
    return this.specialityService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      is_active,
    });
  }

  @ApiOperation({ summary: 'Get a single speciality by ID with topics' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.specialityService.findOne(id);
  }

  @ApiOperation({
    summary: 'Update a speciality (each field is optional; any single field can be updated)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'Cardiology',
          description: 'Speciality name (optional)',
        },
        is_active: {
          type: 'boolean',
          example: true,
          description: 'Whether the speciality is active (optional)',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'New cover image file for the speciality (optional)',
        },
        image_url: {
          type: 'string',
          description: 'Image URL if already hosted (optional)',
        },
      },
    },
  })
  @Patch(':id')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
        fieldSize: 50 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml)$/i)) {
          return cb(
            new BadRequestException(
              `File "${file.originalname}" is not an allowed image format (jpg, jpeg, png, gif, webp, svg)`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  update(
    @Param('id') id: string,
    @Body() updateSpecialityDto: UpdateSpecialityDto,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    return this.specialityService.update(id, updateSpecialityDto, files);
  }

  @ApiOperation({ summary: 'Delete a speciality, its topics, and associated images' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.specialityService.remove(id);
  }

  // ========================== TOPIC ENDPOINTS ==========================

  @ApiOperation({
    summary: 'Add a new topic with image under a specific speciality',
  })
  @ApiParam({ name: 'id', description: 'Speciality ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'Heart Failure',
          description: 'Topic name (required)',
        },
        is_active: {
          type: 'boolean',
          default: true,
          description: 'Whether the topic is active (optional)',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Topic image file (required if no image_url)',
        },
        image_url: {
          type: 'string',
          description: 'Topic image URL if already hosted',
        },
      },
      required: ['name'],
    },
  })
  @Post(':id/topic')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
        fieldSize: 50 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml)$/i)) {
          return cb(
            new BadRequestException(
              `File "${file.originalname}" is not an allowed image format (jpg, jpeg, png, gif, webp, svg)`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  addTopic(
    @Param('id') specialityId: string,
    @Body() addTopicDto: AddTopicDto,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    return this.specialityService.addTopic(specialityId, addTopicDto, files);
  }

  @ApiOperation({ summary: 'Delete a topic by topic ID' })
  @ApiParam({ name: 'topicId', description: 'Topic ID to delete' })
  @Delete('topic/:topicId')
  deleteTopic(@Param('topicId') topicId: string) {
    return this.specialityService.deleteTopic(topicId);
  }

  // @ApiOperation({ summary: 'Delete a topic under a specific speciality' })
  // @ApiParam({ name: 'id', description: 'Speciality ID' })
  // @ApiParam({ name: 'topicId', description: 'Topic ID' })
  // @Delete(':id/topics/:topicId')
  // deleteTopicUnderSpeciality(
  //   @Param('id') specialityId: string,
  //   @Param('topicId') topicId: string,
  // ) {
  //   return this.specialityService.deleteTopic(topicId, specialityId);
  // }

  @ApiOperation({
    summary: 'Update a specific topic (each field is optional; any single field can be updated)',
  })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'Heart Failure',
          description: 'Topic name (optional)',
        },
        is_active: {
          type: 'boolean',
          example: true,
          description: 'Whether the topic is active (optional)',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'New topic image file (optional)',
        },
        image_url: {
          type: 'string',
          description: 'New topic image URL (optional)',
        },
      },
    },
  })
  @Patch('topic/:topicId')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
        fieldSize: 50 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml)$/i)) {
          return cb(
            new BadRequestException(
              `File "${file.originalname}" is not an allowed image format (jpg, jpeg, png, gif, webp, svg)`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  updateTopic(
    @Param('topicId') topicId: string,
    @Body() updateTopicDto: UpdateTopicDto,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    return this.specialityService.updateTopic(topicId, updateTopicDto, files);
  }
}


