import { Module } from '@nestjs/common';
import { SubscriptionPlanService } from './subscription-plan.service';
import { SubscriptionPlanController } from './subscription-plan.controller';
import { SubscriptionCronService } from './subscription-cron.service';

@Module({
  controllers: [SubscriptionPlanController],
  providers: [SubscriptionPlanService, SubscriptionCronService],
})
export class SubscriptionPlanModule {}

