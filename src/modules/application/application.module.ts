import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { TestModule } from './test/test.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { SupportModule } from './support/support.module';
import { SkillsModule } from './skills/skills.module';
import { ProfileModule } from './profile/profile.module';
import { StatisticModule } from './statistic/statistic.module';
import { UserNotificationModule } from './user-notification/user-notification.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [NotificationModule, ContactModule, FaqModule, TestModule, LeaderboardModule, SupportModule, SkillsModule, ProfileModule, StatisticModule, UserNotificationModule, SubscriptionsModule],
})
export class ApplicationModule {}
