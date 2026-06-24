import { Controller, Post, Req, Headers } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { TransactionRepository } from '../../../common/repository/transaction/transaction.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripePayment } from '../../../common/lib/Payment/stripe/StripePayment';
import stripe from 'stripe';

@Controller('payment/stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private transactionRepository: TransactionRepository,
    private prisma: PrismaService,
  ) { }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ) {
    try {
      const payload = req.rawBody.toString();
      const event = await this.stripeService.handleWebhook(payload, signature);

      // Handle events
      switch (event.type) {
        case 'customer.created':
          break;
        case 'payment_intent.created':
          break;
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as stripe.PaymentIntent;
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: paymentIntent.id,
            status: 'succeeded',
            paid_amount: paymentIntent.amount / 100, // amount in dollars
            paid_currency: paymentIntent.currency,
            raw_status: paymentIntent.status,
          });
          break;
        }
        case 'payment_intent.payment_failed': {
          const failedPaymentIntent = event.data.object as stripe.PaymentIntent;
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: failedPaymentIntent.id,
            status: 'failed',
            raw_status: failedPaymentIntent.status,
          });
          break;
        }
        case 'payment_intent.canceled': {
          const canceledPaymentIntent = event.data.object as stripe.PaymentIntent;
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: canceledPaymentIntent.id,
            status: 'canceled',
            raw_status: canceledPaymentIntent.status,
          });
          break;
        }
        case 'payment_intent.requires_action': {
          const requireActionPaymentIntent = event.data.object as stripe.PaymentIntent;
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: requireActionPaymentIntent.id,
            status: 'requires_action',
            raw_status: requireActionPaymentIntent.status,
          });
          break;
        }
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const { user_id, plan_id } = session.metadata || {};

          if (user_id && plan_id) {
            // Find Plan
            const plan = await this.prisma.plan.findUnique({
              where: { id: plan_id },
            });
            if (!plan) {
              console.error(`Plan not found: ${plan_id}`);
              break;
            }

            // Find User
            const user = await this.prisma.user.findUnique({
              where: { id: user_id },
            });
            if (!user) {
              console.error(`User not found: ${user_id}`);
              break;
            }

            // Update user billing_id if not set
            if ((!user.billing_id || user.billing_id.trim().toLowerCase() === 'null') && session.customer) {
              await this.prisma.user.update({
                where: { id: user.id },
                data: { billing_id: session.customer as string },
              });
            }

            let currentPeriodEnd: Date | null = null;
            let stripeSubscriptionId: string | null = null;
            let status = 'active';

            // If it's a recurring subscription
            if (session.mode === 'subscription' && session.subscription) {
              stripeSubscriptionId = session.subscription as string;
              const stripeSub = (await StripePayment.stripe.subscriptions.retrieve(
                stripeSubscriptionId,
              )) as any;
              const periodEndUnix = stripeSub.items?.data?.[0]?.current_period_end;
              currentPeriodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;
              status = stripeSub.status;
            }

            // Find existing subscription
            const existingSubscription = await this.prisma.subscription.findUnique({
              where: { user_id: user.id },
            });

            if (existingSubscription) {
              let newCredits = plan.credits || 0;
              // Accumulate credits if both plans are PAY_AS_YOU_GO
              if (
                existingSubscription.plan_type === 'PAY_AS_YOU_GO' &&
                plan.type === 'PAY_AS_YOU_GO'
              ) {
                newCredits = (existingSubscription.remaining_credits || 0) + (plan.credits || 0);
              }

              await this.prisma.subscription.update({
                where: { user_id: user.id },
                data: {
                  plan_id: plan.id,
                  plan_type: plan.type,
                  stripe_subscription_id: stripeSubscriptionId,
                  status: status,
                  current_period_end: currentPeriodEnd,
                  remaining_credits: plan.type === 'PAY_AS_YOU_GO' ? newCredits : null,
                },
              });
            } else {
              await this.prisma.subscription.create({
                data: {
                  user_id: user.id,
                  plan_id: plan.id,
                  plan_type: plan.type,
                  stripe_subscription_id: stripeSubscriptionId,
                  status: status,
                  current_period_end: currentPeriodEnd,
                  remaining_credits: plan.type === 'PAY_AS_YOU_GO' ? (plan.credits || 0) : null,
                },
              });
            }

            // Record transaction
            await this.prisma.paymentTransaction.create({
              data: {
                user_id: user.id,
                amount: session.amount_total ? session.amount_total / 100 : plan.price,
                currency: session.currency || 'usd',
                reference_number: session.id,
                status: 'succeeded',
                raw_status: session.payment_status,
                type: 'subscription',
                provider: 'stripe',
                paid_amount: session.amount_total ? session.amount_total / 100 : plan.price,
                paid_currency: session.currency || 'usd',
              },
            });
          }
          break;
        }
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as any;
          if (invoice.subscription) {
            const stripeSubscriptionId = invoice.subscription as string;

            const stripeSub = (await StripePayment.stripe.subscriptions.retrieve(
              stripeSubscriptionId,
            )) as any;
            const periodEndUnix = stripeSub.items?.data?.[0]?.current_period_end;
            const currentPeriodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;

            const dbSub = await this.prisma.subscription.findFirst({
              where: { stripe_subscription_id: stripeSubscriptionId },
            });

            if (dbSub) {
              await this.prisma.subscription.update({
                where: { id: dbSub.id },
                data: {
                  status: stripeSub.status,
                  current_period_end: currentPeriodEnd,
                },
              });

              await this.prisma.paymentTransaction.create({
                data: {
                  user_id: dbSub.user_id,
                  amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
                  currency: invoice.currency || 'usd',
                  reference_number: invoice.id,
                  status: 'succeeded',
                  raw_status: 'paid',
                  type: 'subscription_renewal',
                  provider: 'stripe',
                  paid_amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
                  paid_currency: invoice.currency || 'usd',
                },
              });
            }
          }
          break;
        }
        case 'customer.subscription.updated': {
          const stripeSub = event.data.object as any;
          const stripeSubscriptionId = stripeSub.id;
          const periodEndUnix = stripeSub.items?.data?.[0]?.current_period_end;
          const currentPeriodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;

          const dbSub = await this.prisma.subscription.findFirst({
            where: { stripe_subscription_id: stripeSubscriptionId },
          });

          if (dbSub) {
            const priceId = stripeSub.items?.data?.[0]?.price?.id;
            let planId = dbSub.plan_id;
            let planType = dbSub.plan_type;

            if (priceId) {
              const matchingPlan = await this.prisma.plan.findFirst({
                where: { stripe_price_id: priceId },
              });
              if (matchingPlan) {
                planId = matchingPlan.id;
                planType = matchingPlan.type;
              }
            }

            await this.prisma.subscription.update({
              where: { id: dbSub.id },
              data: {
                status: stripeSub.status,
                current_period_end: currentPeriodEnd,
                plan_id: planId,
                plan_type: planType,
              },
            });
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const stripeSub = event.data.object as any;
          const stripeSubscriptionId = stripeSub.id;

          const dbSub = await this.prisma.subscription.findFirst({
            where: { stripe_subscription_id: stripeSubscriptionId },
          });

          if (dbSub) {
            await this.prisma.subscription.update({
              where: { id: dbSub.id },
              data: {
                status: 'canceled',
              },
            });
          }
          break;
        }
        case 'payout.paid': {
          const paidPayout = event.data.object;
          console.log(paidPayout);
          break;
        }
        case 'payout.failed': {
          const failedPayout = event.data.object;
          console.log(failedPayout);
          break;
        }
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error', error);
      return { received: false };
    }
  }
}
