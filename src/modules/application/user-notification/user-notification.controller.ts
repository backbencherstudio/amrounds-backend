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
} from '@nestjs/common';
import { UserNotificationService } from './user-notification.service';
import { CreateUserNotificationDto } from './dto/create-user-notification.dto';
import { UpdateUserNotificationDto } from './dto/update-user-notification.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('User Notification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
@Controller('user/notification')
export class UserNotificationController {
  constructor(
    private readonly userNotificationService: UserNotificationService,
  ) {}

  @Get()
  findAllNotification(@Req() req: Request) {
    const user_id = req.user.userId;
    return this.userNotificationService.findAllNotification(user_id);
  }

  @Delete(':id')
  removeNotification(@Req() req: Request, @Param('id') id: string) {
    const user_id = req.user.userId;
    return this.userNotificationService.removeNotification(id, user_id);
  }

  @Delete()
  removeAllNotification(@Req() req: Request) {
    const user_id = req.user.userId;
    return this.userNotificationService.removeAllNotification(user_id);
  }
}
