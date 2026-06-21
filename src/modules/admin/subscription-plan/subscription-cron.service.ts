import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(private readonly prisma: PrismaService) { }

  // Run daily at midnight to check and expire subscriptions
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionExpiration() {
    this.logger.log('Starting daily subscription expiration check...');
    try {
      const now = new Date();

      // Find all subscriptions that are active, and:
      // 1. Either they are MONTHLY and whose current_period_end is in the past (expired)
      // 2. Or they are PAY_AS_YOU_GO and whose remaining_credits is less than or equal to 0
      const expiredSubscriptions = await this.prisma.subscription.findMany({
        where: {
          status: 'active',
          OR: [
            {
              plan_type: 'MONTHLY',
              current_period_end: {
                lt: now,
              },
            },
            {
              plan_type: 'PAY_AS_YOU_GO',
              remaining_credits: {
                lte: 0,
              },
            },
          ],
        },
      });

      if (expiredSubscriptions.length === 0) {
        this.logger.log('No expired subscriptions found.');
        return;
      }

      this.logger.log(`Found ${expiredSubscriptions.length} expired subscriptions. Expiring them...`);

      // Update statuses to expired
      const updateResult = await this.prisma.subscription.updateMany({
        where: {
          id: {
            in: expiredSubscriptions.map((sub) => sub.id),
          },
        },
        data: {
          status: 'expired',
        },
      });

      this.logger.log(`Successfully expired ${updateResult.count} subscriptions.`);
    } catch (error) {
      this.logger.error('Failed to run subscription expiration check: ' + error.message);
    }
  }
}
