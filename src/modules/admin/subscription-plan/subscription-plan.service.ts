import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateSubscriptionPlanDto,
  PlanType,
} from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import stripe from 'stripe';

@Injectable()
export class SubscriptionPlanService {
  constructor(private readonly prisma: PrismaService) { }

  private parseBillingPeriod(billingPeriod?: string): { interval: stripe.PriceCreateParams.Recurring.Interval; interval_count?: number } {
    const period = (billingPeriod || 'monthly').toLowerCase().trim();
    
    if (period === 'yearly' || period === 'year' || period === '12_months') {
      return { interval: 'year', interval_count: 1 };
    }
    if (period === 'monthly' || period === 'month' || period === '1_month') {
      return { interval: 'month', interval_count: 1 };
    }
    if (period === 'quarterly' || period === '3_months') {
      return { interval: 'month', interval_count: 3 };
    }
    if (period === '6_months' || period === 'half_yearly') {
      return { interval: 'month', interval_count: 6 };
    }
    if (period === '24_months' || period === '2_years') {
      return { interval: 'year', interval_count: 2 };
    }
    
    // Check numeric format: e.g. "6_months" or "2_years"
    const monthMatch = period.match(/^(\d+)\s*(_|)?months?$/);
    if (monthMatch) {
      const count = parseInt(monthMatch[1], 10);
      return { interval: 'month', interval_count: count };
    }
    const yearMatch = period.match(/^(\d+)\s*(_|)?years?$/);
    if (yearMatch) {
      const count = parseInt(yearMatch[1], 10);
      return { interval: 'year', interval_count: count };
    }
    
    return { interval: 'month', interval_count: 1 };
  }

  async createPlan(createSubscriptionPlanDto: CreateSubscriptionPlanDto) {
    try {
      // 1. Create a Product in Stripe
      const stripeProduct = await StripePayment.createProduct(
        createSubscriptionPlanDto.name || 'Unnamed Plan',
        `Subscription Plan: ${createSubscriptionPlanDto.name}`,
      );

      // 2. Create a Price in Stripe linked to the Product
      let interval: stripe.PriceCreateParams.Recurring.Interval = undefined;
      let interval_count: number = undefined;
      if (
        !createSubscriptionPlanDto.type ||
        createSubscriptionPlanDto.type === PlanType.MONTHLY
      ) {
        const parsed = this.parseBillingPeriod(createSubscriptionPlanDto.billing_period);
        interval = parsed.interval;
        interval_count = parsed.interval_count;
      }

      const stripePrice = await StripePayment.createPrice(
        stripeProduct.id,
        createSubscriptionPlanDto.price,
        'usd',
        interval,
        interval_count,
      );

      // 3. Save to database with Stripe IDs
      const plan = await this.prisma.plan.create({
        data: {
          name: createSubscriptionPlanDto.name,
          type: createSubscriptionPlanDto.type || PlanType.MONTHLY,
          price: createSubscriptionPlanDto.price,
          billing_period: createSubscriptionPlanDto.billing_period,
          credits: createSubscriptionPlanDto.credits,
          benefits: createSubscriptionPlanDto.benefits,
          stripe_product_id: stripeProduct.id,
          stripe_price_id: stripePrice.id,
        },
      });

      return {
        success: true,
        message:
          'Subscription plan created successfully and synced with Stripe',
        data: plan,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create subscription plan: ' + error.message,
      };
    }
  }

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

  async findAllBillingHistory() {
    try {
      const billingHistory = await this.prisma.subscription.findMany({
        select: {
          id: true,
          plan_id: true,
          user_id: true,
          status: true,
          current_period_end: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: { created_at: 'desc' },
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

  async updatePlan(
    id: string,
    updateSubscriptionPlanDto: UpdateSubscriptionPlanDto,
  ) {
    try {
      const plan = await this.prisma.plan.findUnique({
        where: { id },
      });

      if (!plan) {
        throw new NotFoundException(`Subscription plan not found`);
      }

      let stripePriceId = plan.stripe_price_id;

      // Update product name in Stripe if provided
      if (
        updateSubscriptionPlanDto.name &&
        updateSubscriptionPlanDto.name !== plan.name
      ) {
        await StripePayment.updateProduct(
          plan.stripe_product_id,
          updateSubscriptionPlanDto.name,
          `Subscription Plan: ${updateSubscriptionPlanDto.name}`,
        );
      }

      // If price or billing_period changes, create a new price and deactivate the old one
      if (
        (updateSubscriptionPlanDto.price !== undefined &&
          updateSubscriptionPlanDto.price !== Number(plan.price)) ||
        (updateSubscriptionPlanDto.billing_period !== undefined &&
          updateSubscriptionPlanDto.billing_period !== plan.billing_period) ||
        (updateSubscriptionPlanDto.type !== undefined &&
          updateSubscriptionPlanDto.type !== plan.type)
      ) {
        const newPrice = updateSubscriptionPlanDto.price ?? Number(plan.price);
        const newType = updateSubscriptionPlanDto.type ?? (plan.type as PlanType);
        const newBillingPeriod = updateSubscriptionPlanDto.billing_period ?? plan.billing_period;

        let interval: stripe.PriceCreateParams.Recurring.Interval = undefined;
        let interval_count: number = undefined;
        if (newType === PlanType.MONTHLY) {
          const parsed = this.parseBillingPeriod(newBillingPeriod);
          interval = parsed.interval;
          interval_count = parsed.interval_count;
        }

        const newStripePrice = await StripePayment.createPrice(
          plan.stripe_product_id,
          newPrice,
          'usd',
          interval,
          interval_count,
        );

        if (plan.stripe_price_id) {
          await StripePayment.deactivatePrice(plan.stripe_price_id);
        }

        stripePriceId = newStripePrice.id;
      }

      const updatedPlan = await this.prisma.plan.update({
        where: { id },
        data: {
          name: updateSubscriptionPlanDto.name,
          type: updateSubscriptionPlanDto.type,
          price: updateSubscriptionPlanDto.price,
          billing_period: updateSubscriptionPlanDto.billing_period,
          credits: updateSubscriptionPlanDto.credits,
          benefits: updateSubscriptionPlanDto.benefits,
          stripe_price_id: stripePriceId,
        },
      });

      return {
        success: true,
        message: 'Subscription plan updated successfully',
        data: updatedPlan,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update subscription plan: ' + error.message,
      };
    }
  }

  async removePlan(id: string) {
    try {
      const plan = await this.prisma.plan.findUnique({
        where: { id },
      });

      if (!plan) {
        throw new NotFoundException(`Subscription plan not found`);
      }

      // Deactivate price and product from Stripe
      if (plan.stripe_price_id) {
        await StripePayment.deactivatePrice(plan.stripe_price_id);
      }
      if (plan.stripe_product_id) {
        await StripePayment.deactivateProduct(plan.stripe_product_id);
      }

      await this.prisma.plan.delete({
        where: { id },
      });

      return {
        success: true,
        message:
          'Subscription plan deleted and deactivated in Stripe effectively',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete subscription plan: ' + error.message,
      };
    }
  }
}
