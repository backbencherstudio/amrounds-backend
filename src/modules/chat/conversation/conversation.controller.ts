import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Conversation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat/conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Roles(Role.USER)
  @ApiOperation({ summary: 'Create conversation' })
  @Post()
  async create(
    @Req() req: Request,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    try {
      // console.log(req.user.userId);
      const conversation = await this.conversationService.create(
        req.user.userId,
        createConversationDto,
      );
      return conversation;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // @Roles(Role.USER)
  @ApiOperation({ summary: 'Get all conversations' })
  @Get()
  async findAll(@Req() req: Request) {
    try {
      const conversations = await this.conversationService.findAll(
        req.user.userId,
      );
      return conversations;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // @Roles(Role.USER)
  @ApiOperation({ summary: 'Get a conversation by id' })
  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    try {
      const conversation = await this.conversationService.findOne(
        req.user.userId,
        id,
      );
      return conversation;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // @Roles(Role.USER)
  @ApiOperation({ summary: 'Delete a conversation' })
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    try {
      const conversation = await this.conversationService.remove(
        req.user.userId,
        id,
      );
      return conversation;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // user create a conversation with admins
  // @Roles(Role.USER)
  @ApiOperation({ summary: 'User create a conversation with all admins' })
  @Post('admin')
  async createAdminConversation(
    @Req() req: Request,
    @Body() body?: { participant_id?: string },
  ) {
    try {
      const conversation =
        await this.conversationService.createAdminConversation(
          req.user.userId,
          body?.participant_id,
        );
      return conversation;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
