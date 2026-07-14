import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) { }

  async findAllPlans() {
    try {
      const plans = await this.prisma.plan.findMany({
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          price: true,
          billing_period: true,
          credits: true,
          benefits: true,
          is_popular: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!plans) {
        throw new NotFoundException(`Subscription plan not found`);
      }

      const formattedPlans = plans.map((plan) => {
        if (plan.type === 'MONTHLY') {
          const { credits, ...rest } = plan;
          return rest;
        }
        if (plan.type === 'PAY_AS_YOU_GO') {
          const { billing_period, ...rest } = plan;
          return rest;
        }
        return plan;
      });

      return {
        success: true,
        message: 'Subscription plans retrieved successfully',
        data: formattedPlans,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve subscription plans: ' + error.message,
      };
    }
  }

  async findOnePlan(id: string) {
    try {
      const plan = await this.prisma.plan.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          type: true,
          price: true,
          billing_period: true,
          credits: true,
          benefits: true,
          is_popular: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!plan) {
        throw new NotFoundException(`Subscription plan not found`);
      }

      let formattedPlan: any = plan;
      if (plan.type === 'MONTHLY') {
        const { credits, ...rest } = plan;
        formattedPlan = rest;
      } else if (plan.type === 'PAY_AS_YOU_GO') {
        const { billing_period, ...rest } = plan;
        formattedPlan = rest;
      }

      return {
        success: true,
        message: 'Subscription plan retrieved successfully',
        data: formattedPlan,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve subscription plan: ' + error.message,
      };
    }
  }

  async buySubscription(id: string, user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      if (user.approved_at == null) {
        throw new NotFoundException('User not approved');
      }
      // Check for active monthly subscription
      const existingSub = await this.prisma.subscription.findUnique({
        where: { user_id: user_id },
      });

      if (
        existingSub &&
        existingSub.plan_type === 'MONTHLY' &&
        existingSub.status === 'active' &&
        existingSub.current_period_end &&
        new Date(existingSub.current_period_end) > new Date()
      ) {
        return {
          success: false,
          message: 'You already have an active monthly subscription.',
        };
      }

      const plan = await this.prisma.plan.findUnique({
        where: { id },
      });

      if (!plan) {
        throw new NotFoundException(`Subscription plan not found`);
      }

      if (!plan.stripe_price_id) {
        return {
          success: false,
          message: 'Plan is not configured with Stripe',
        };
      }

      const dbUser = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      let customerId = dbUser.billing_id;
      if (!customerId || customerId.trim().toLowerCase() === 'null') {
        const customer = await StripePayment.createCustomer({
          user_id: dbUser.id,
          name:
            dbUser.name ||
            `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() ||
            'Customer',
          email: dbUser.email,
        });
        customerId = customer.id;
        await this.prisma.user.update({
          where: { id: user_id },
          data: { billing_id: customerId },
        });
      }

      const metadata = {
        user_id: user_id,
        plan_id: plan.id,
        type: 'subscription',
      };

      let session;
      if (plan.type === 'MONTHLY') {
        session = await StripePayment.createCheckoutSessionSubscription(
          customerId,
          plan.stripe_price_id,
          metadata,
        );
      } else {
        session = await StripePayment.createCheckoutSessionPayment(
          customerId,
          plan.stripe_price_id,
          metadata,
        );
      }

      return {
        success: true,
        message: 'Subscription session created successfully',
        data: {
          url: session.url,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create subscription session: ' + error.message,
      };
    }
  }

  async allBilingHistory(user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      if (user.approved_at == null) {
        throw new NotFoundException('User not approved');
      }
      const billingHistory = await this.prisma.paymentTransaction.findMany({
        where: { user_id },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!billingHistory) {
        throw new NotFoundException(`Billing history not found`);
      }

      return {
        success: true,
        message: 'Billing history retrieved successfully',
        data: billingHistory,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve billing history: ' + error.message,
      };
    }
  }

  async mySubscription(user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      if (user.approved_at == null) {
        throw new NotFoundException('User not approved');
      }
      let subscription = await this.prisma.subscription.findUnique({
        where: { user_id },
        select: {
          id: true,
          user_id: true,
          plan_id: true,
          status: true,
          plan_type: true,
          current_period_end: true,
          remaining_credits: true,
          created_at: true,
          updated_at: true,
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
              billing_period: true,
              credits: true,
              benefits: true,
              is_popular: true,
            },
          },
        },
      });

      if (!subscription) {
        return {
          success: true,
          message: 'No subscription found',
          data: null,
        };
      }

      if (subscription.status === 'active') {
        let isExpired = false;

        if (subscription.plan_type === 'MONTHLY') {
          if (
            !subscription.current_period_end ||
            new Date(subscription.current_period_end) < new Date()
          ) {
            isExpired = true;
          }
        } else if (subscription.plan_type === 'PAY_AS_YOU_GO') {
          if (
            subscription.remaining_credits === null ||
            subscription.remaining_credits <= 0
          ) {
            isExpired = true;
          }
        }

        if (isExpired) {
          subscription = (await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'expired' },
            include: { plan: true },
          })) as any;
        }
      }

      const formattedSubscription: any = { ...subscription };
      if (formattedSubscription.plan_type === 'PAY_AS_YOU_GO') {
        delete formattedSubscription.current_period_end;
      } else if (formattedSubscription.plan_type === 'MONTHLY') {
        delete formattedSubscription.remaining_credits;
      }

      return {
        success: true,
        message: 'Subscription retrieved successfully',
        data: formattedSubscription,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve subscription: ' + error.message,
      };
    }
  }

  async myActiveSubscription(user_id: string) {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { user_id },
        include: {
          plan: true,
        },
      });

      if (!subscription || subscription.status !== 'active') {
        return {
          success: false,
          message: 'No active subscription found',
          data: null,
        };
      }

      const testCount = await this.prisma.test.count({
        where: {
          user_id,
          created_at: {
            gte: subscription.created_at,
          },
        },
      });

      const formatDate = (d: Date) => {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      };

      // Calculate the approximate start of the current cycle if monthly
      let start_date = new Date(subscription.created_at);
      if (
        subscription.plan_type === 'MONTHLY' &&
        subscription.current_period_end
      ) {
        const end = new Date(subscription.current_period_end);
        // Estimate start date as 1 month before end date
        const estStart = new Date(end);
        estStart.setMonth(estStart.getMonth() - 1);
        if (estStart > start_date) {
          start_date = estStart;
        }
      }

      let billing_period = '';
      let next_payment = '';

      if (subscription.plan_type === 'MONTHLY') {
        const endDateStr = subscription.current_period_end
          ? formatDate(new Date(subscription.current_period_end))
          : 'Unknown';

        billing_period = `Your current cycle is ${formatDate(start_date)} - ${endDateStr}`;

        const nextPaymentDateStr = subscription.current_period_end
          ? new Date(subscription.current_period_end).toLocaleDateString(
            'en-US',
            { month: 'long', day: 'numeric' },
          )
          : 'Unknown date';

        next_payment = `£${subscription.plan.price} will be charged on ${nextPaymentDateStr}`;
      } else {
        billing_period = `Started on ${formatDate(new Date(subscription.created_at))}`;
        next_payment =
          subscription.remaining_credits > 0
            ? `You have ${subscription.remaining_credits} credits remaining`
            : `No remaining credits`;
      }

      return {
        success: true,
        message: 'Active subscription overview retrieved successfully',
        data: {
          active_plan: subscription.plan.name,
          billing_period: billing_period,
          next_payment: next_payment,
          notices_published: `You've Created total ${testCount} test`,
        },
      };
    } catch (error) {
      return {
        success: false,
        message:
          'Failed to retrieve active subscription overview: ' + error.message,
      };
    }
  }

  async cancelSubscription(user_id: string) {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { user_id },
      });

      if (!subscription) {
        return { success: false, message: 'Subscription not found' };
      }

      // If it's a recurring subscription on Stripe, cancel it
      if (
        subscription.plan_type === 'MONTHLY' &&
        subscription.stripe_subscription_id
      ) {
        await StripePayment.stripe.subscriptions.cancel(
          subscription.stripe_subscription_id,
        );
      }

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'canceled' },
      });

      return {
        success: true,
        message: 'Subscription canceled successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to cancel subscription: ' + error.message,
      };
    }
  }

  async changeSubscriptionPlan(user_id: string, new_plan_id: string) {
    try {
      if (!new_plan_id) {
        return { success: false, message: 'New plan ID is required' };
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { user_id },
      });

      if (!subscription) {
        return {
          success: false,
          message: 'Active subscription not found to change',
        };
      }

      const newPlan = await this.prisma.plan.findUnique({
        where: { id: new_plan_id },
      });

      if (!newPlan) {
        return { success: false, message: 'The requested plan does not exist' };
      }

      // If it's a recurring subscription on Stripe, update Stripe subscription
      if (
        subscription.plan_type === 'MONTHLY' &&
        subscription.stripe_subscription_id &&
        newPlan.stripe_price_id
      ) {
        const stripeSub = (await StripePayment.stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id,
        )) as any;
        const subscriptionItemId = stripeSub.items.data[0].id;
        await StripePayment.stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          {
            items: [
              {
                id: subscriptionItemId,
                price: newPlan.stripe_price_id,
              },
            ],
            proration_behavior: 'create_prorations',
          },
        );
      }

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          plan_id: new_plan_id,
          plan_type: newPlan.type,
        },
      });

      return {
        success: true,
        message: 'Subscription plan changed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to change subscription plan: ' + error.message,
      };
    }
  }
}
