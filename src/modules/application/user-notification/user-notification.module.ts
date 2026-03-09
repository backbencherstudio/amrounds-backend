import { Module } from '@nestjs/common';
import { UserNotificationService } from './user-notification.service';
import { UserNotificationController } from './user-notification.controller';

@Module({
  controllers: [UserNotificationController],
  providers: [UserNotificationService],
})
export class UserNotificationModule {}
