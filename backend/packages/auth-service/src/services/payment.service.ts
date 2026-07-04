import Stripe from 'stripe';
import { stripeConfig } from '../config/stripe.js';
import { models } from '../index.js';
// @ts-ignore
import { OrganizationPlanSyncService } from './organization-plan-sync.service.js';
import { EmailQueue } from '@minimeet/shared';

let _stripe: Stripe | null = null;
const getStripe = (): Stripe => {
  if (!_stripe) {
    if (!stripeConfig.secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    _stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: '2023-10-16' as any,
    });
  }
  return _stripe;
};

const findUserByCustomerId = async (customerId: string) => {
  try {
    const user = await models.User.findOne({
      stripeCustomerId: customerId,
    });
    return user;
  } catch (error) {
    console.error('Error finding user by customer ID:', error);
    return null;
  }
};

export class PaymentService {
  /**
   * Create a Stripe customer
   */
  static async createCustomer(userEmail: string, userName: string) {
    try {
      const stripe = getStripe();
      const customer = await stripe.customers.create({
        email: userEmail,
        name: userName,
        metadata: {
          userEmail: userEmail,
        },
      });
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create a payment intent for plan upgrade
   */
  static async createPaymentIntent(
    amount: number,
    currency: string,
    customerId: string,
    metadata: any = {}
  ) {
    try {
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // Convert to cents
        currency: currency.toLowerCase(),
        customer: customerId,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Create a subscription for recurring billing
   */
  static async createSubscription(customerId: string, priceId: string, metadata: any = {}) {
    try {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });
      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Create a checkout session for one-time payments
   */
  static async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    metadata: any = {}
  ) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });
      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a subscription checkout session
   */
  static async createSubscriptionCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    metadata: any = {}
  ) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });
      return session;
    } catch (error) {
      console.error('Error creating subscription checkout session:', error);
      throw error;
    }
  }

  /**
   * Retrieve a payment intent
   */
  static async getPaymentIntent(paymentIntentId: string) {
    try {
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );
      return paymentIntent;
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      throw error;
    }
  }

  /**
   * Retrieve a subscription
   */
  static async getSubscription(subscriptionId: string) {
    try {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(subscriptionId: string, immediately = false) {
    try {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: !immediately,
        ...(immediately && { cancel_at: Math.floor(Date.now() / 1000) }),
      });
      return subscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Create a billing portal session
   */
  static async createBillingPortalSession(customerId: string, returnUrl: string) {
    try {
      const stripe = getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return session;
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      throw error;
    }
  }

  /**
   * Handle webhook events with replay protection
   */
  static async handleWebhookEvent(event: any) {
    try {
      const eventAge = Date.now() - event.created * 1000;
      const maxEventAge = 24 * 60 * 60 * 1000; // 24 hours
      if (eventAge > maxEventAge) {
        return {
          handled: false,
          message: 'Event too old, possible replay attack',
        };
      }

      switch (event.type) {
        case 'checkout.session.completed':
          return await this.handleCheckoutSessionCompleted(event.data.object);

        case 'payment_intent.succeeded':
          return await this.handlePaymentSuccess(event.data.object);

        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailure(event.data.object);

        case 'customer.subscription.created':
          return await this.handleSubscriptionCreated(event.data.object);

        case 'customer.subscription.updated':
          return await this.handleSubscriptionUpdated(event.data.object);

        case 'customer.subscription.deleted':
          return await this.handleSubscriptionDeleted(event.data.object);

        case 'invoice.payment_succeeded':
          return await this.handleInvoicePaymentSucceeded(event.data.object);

        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(event.data.object);

        default:
          return { handled: false };
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  /**
   * Handle checkout session completed
   */
  static async handleCheckoutSessionCompleted(session: any) {
    try {
      if (session.payment_status !== 'paid') {
        return { handled: false, message: 'Payment not completed' };
      }

      const { userId, planType, duration } = session.metadata;

      if (!userId || !planType) {
        console.error('Missing metadata in checkout session:', session.id);
        return { handled: false, message: 'Missing required metadata' };
      }

      if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
        console.error('Invalid userId format in session metadata:', userId);
        return { handled: false, message: 'Invalid userId format' };
      }

      const validPlans = ['pro', 'enterprise'];
      if (!validPlans.includes(planType)) {
        console.error('Invalid planType in session metadata:', planType);
        return { handled: false, message: 'Invalid planType' };
      }

      const existingUser = await models.User.findById(userId);
      if (existingUser && existingUser.plan.stripeSessionId === session.id) {
        return {
          handled: true,
          message: 'Already processed',
          idempotent: true,
        };
      }

      let subscriptionId: any = null;
      let endDate: Date | null = null;
      let startDate = new Date();

      if (session.subscription) {
        const stripe = getStripe();
        const subscription: any =
          typeof session.subscription === 'string'
            ? await stripe.subscriptions.retrieve(session.subscription)
            : session.subscription;

        subscriptionId = subscription.id;
        endDate = new Date(subscription.current_period_end * 1000);
        startDate = new Date(subscription.current_period_start * 1000);
      } else {
        endDate = new Date();
        if (duration === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (duration === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }
      }

      const updatedUser = await models.User.findByIdAndUpdate(
        userId,
        {
          'plan.type': planType,
          'plan.status': 'active',
          'plan.startDate': startDate,
          'plan.endDate': endDate,
          'plan.stripeSessionId': session.id,
          ...(subscriptionId && {
            'plan.stripeSubscriptionId': subscriptionId,
          }),
          $inc: { tokenVersion: 1 },
        },
        { new: true }
      );

      if (updatedUser) {
        await OrganizationPlanSyncService.syncUserOrganizations(userId);
        return { handled: true, userId, planType };
      }

      return { handled: false };
    } catch (error) {
      console.error('Error handling checkout session completed:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  static async handlePaymentSuccess(paymentIntent: any) {
    try {
      const { userId, planType, duration } = paymentIntent.metadata;

      if (!userId || !planType) {
        console.error('Missing metadata in payment intent:', paymentIntent.id);
        return { handled: false };
      }

      const endDate = new Date();
      if (duration === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (duration === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      const user = await models.User.findByIdAndUpdate(
        userId,
        {
          'plan.type': planType,
          'plan.status': 'active',
          'plan.startDate': new Date(),
          'plan.endDate': endDate,
          'plan.stripePaymentIntentId': paymentIntent.id,
          $inc: { tokenVersion: 1 },
        },
        { new: true }
      );

      if (user) {
        await models.Organization.updateMany(
          { ownerId: userId },
          {
            'plan.type': planType,
            'plan.status': 'active',
            'plan.startDate': new Date(),
            'plan.endDate': endDate,
          }
        );

        return { handled: true, userId, planType };
      }

      return { handled: false };
    } catch (error) {
      console.error('Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  static async handlePaymentFailure(paymentIntent: any) {
    try {
      const { userId, planType } = paymentIntent.metadata;

      if (userId) {
        const user = await models.User.findById(userId);
        if (user) {
          try {
            const emailQueue = new EmailQueue();

            await emailQueue.addEmailJob(
              'payment_failure',
              {
                userEmail: user.email,
                userName: user.name || user.email,
                planType: planType || 'premium',
                errorMessage: paymentIntent.last_payment_error?.message || 'Payment could not be processed',
              },
              {
                priority: 1,
                jobId: `payment-failure-${paymentIntent.id}`,
              }
            );
          } catch (emailError) {
            console.error('Failed to queue payment failure email:', emailError);
          }
        }
      }

      return { handled: true };
    } catch (error) {
      console.error('Error handling payment failure:', error);
      throw error;
    }
  }

  /**
   * Handle subscription created
   */
  static async handleSubscriptionCreated(subscription: any) {
    try {
      const { userId, planType } = subscription.metadata;

      let user = null;

      if (userId) {
        user = await models.User.findById(userId);
      }

      if (!user && subscription.customer) {
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
        user = await findUserByCustomerId(customerId);
      }

      if (user) {
        const endDate = new Date(subscription.current_period_end * 1000);
        const startDate = new Date(subscription.current_period_start * 1000);

        let planTypeToSet = planType;
        if (!planTypeToSet && subscription.items?.data?.[0]?.price) {
          planTypeToSet = user.plan.type;
        }

        await models.User.findByIdAndUpdate(user._id, {
          'plan.stripeSubscriptionId': subscription.id,
          'plan.status': 'active',
          ...(planTypeToSet && { 'plan.type': planTypeToSet }),
          'plan.startDate': startDate,
          'plan.endDate': endDate,
          $inc: { tokenVersion: 1 },
        });

        await OrganizationPlanSyncService.syncUserOrganizations(user._id);
      }

      return { handled: true };
    } catch (error) {
      console.error('Error handling subscription created:', error);
      throw error;
    }
  }

  /**
   * Handle subscription updated
   */
  static async handleSubscriptionUpdated(subscription: any) {
    try {
      const { userId } = subscription.metadata;

      let user = null;

      if (userId) {
        user = await models.User.findById(userId);
      }

      if (!user) {
        if (subscription.customer) {
          const customerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer.id;
          user = await findUserByCustomerId(customerId);
        }

        if (!user) {
          user = await models.User.findOne({
            'plan.stripeSubscriptionId': subscription.id,
          });
        }
      }

      if (user) {
        const status =
          subscription.status === 'active'
            ? 'active'
            : subscription.status === 'canceled' ||
              subscription.cancel_at_period_end
            ? 'cancelled'
            : 'cancelled';

        const updateData: any = {
          'plan.status': status,
          $inc: { tokenVersion: 1 },
        };

        if (
          subscription.status === 'active' &&
          subscription.current_period_end
        ) {
          updateData['plan.endDate'] = new Date(
            subscription.current_period_end * 1000
          );
        }

        if (subscription.cancel_at_period_end) {
          updateData['plan.status'] = 'active';
        }

        await models.User.findByIdAndUpdate(user._id, updateData);
      }

      return { handled: true };
    } catch (error) {
      console.error('Error handling subscription updated:', error);
      throw error;
    }
  }

  /**
   * Handle subscription deleted
   */
  static async handleSubscriptionDeleted(subscription: any) {
    try {
      const { userId } = subscription.metadata;

      let user = null;

      if (userId) {
        user = await models.User.findById(userId);
      }

      if (!user) {
        user = await models.User.findOne({
          'plan.stripeSubscriptionId': subscription.id,
        });
      }

      if (!user && subscription.customer) {
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
        user = await findUserByCustomerId(customerId);
      }

      if (user) {
        const previousPlanType = user.plan?.type || 'pro';

        await models.User.findByIdAndUpdate(user._id, {
          'plan.type': 'free',
          'plan.status': 'active',
          'plan.stripeSubscriptionId': null,
          'plan.endDate': null,
          'plan.startDate': new Date(),
          $inc: { tokenVersion: 1 },
        });

        await models.Organization.updateMany(
          { ownerId: user._id },
          {
            'plan.type': 'free',
            'plan.status': 'active',
            'plan.startDate': new Date(),
            'plan.endDate': null,
          }
        );

        await OrganizationPlanSyncService.syncUserOrganizations(user._id);

        try {
          const emailQueue = new EmailQueue();
          await emailQueue.addEmailJob(
            'plan_downgrade',
            {
              userId: user._id.toString(),
              userEmail: user.email,
              userName: user.name || '',
              previousPlanType: previousPlanType,
              newPlanType: 'free',
            },
            {
              priority: 1,
              jobId: `plan-downgrade-${user._id}-${Date.now()}`,
            }
          );
        } catch (emailError) {
          console.error('Failed to queue downgrade email:', emailError);
        }
      }

      return { handled: true };
    } catch (error) {
      console.error('Error handling subscription deleted:', error);
      throw error;
    }
  }

  /**
   * Handle successful invoice payment
   */
  static async handleInvoicePaymentSucceeded(invoice: any) {
    try {
      const stripe = getStripe();
      const { userId } = invoice.metadata;

      let user = null;

      if (userId) {
        user = await models.User.findById(userId);
      }

      if (!user && invoice.customer) {
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer.id;
        user = await findUserByCustomerId(customerId);
      }

      if (user && invoice.subscription) {
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

        const subscription = (await stripe.subscriptions.retrieve(
          subscriptionId
        )) as any;

        const endDate = new Date(subscription.current_period_end * 1000);
        const startDate = new Date(subscription.current_period_start * 1000);

        await models.User.findByIdAndUpdate(user._id, {
          'plan.status': 'active',
          'plan.lastPaymentDate': new Date(),
          'plan.endDate': endDate,
          'plan.startDate': startDate,
          'plan.stripeSubscriptionId': subscriptionId,
          $inc: { tokenVersion: 1 },
        });

        await OrganizationPlanSyncService.syncUserOrganizations(user._id);
      }

      return { handled: true };
    } catch (error) {
      console.error('Error handling invoice payment succeeded:', error);
      throw error;
    }
  }

  /**
   * Handle failed invoice payment
   */
  static async handleInvoicePaymentFailed(invoice: any) {
    try {
      const { userId } = invoice.metadata;

      let user = null;

      if (userId) {
        user = await models.User.findById(userId);
      }

      if (!user && invoice.customer) {
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer.id;
        user = await findUserByCustomerId(customerId);
      }

      if (user) {
        await models.User.findByIdAndUpdate(user._id, {
          'plan.status': 'past_due',
          $inc: { tokenVersion: 1 },
        });
      }

      return { handled: true };
    } catch (error) {
      console.error('Error handling invoice payment failed:', error);
      throw error;
    }
  }
}
export default PaymentService;
