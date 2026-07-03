import Stripe from 'stripe';
import { stripeConfig } from '../config/stripe.js';
import { models } from '../index.js';
import { OrganizationPlanSyncService } from './organization-plan-sync.service.js';
import { EmailQueue } from '@minimeet/shared';
import { getPaymentFailureEmailTemplate } from '../templates/payment-failure-email.js';
import { getPlanDowngradeEmailTemplate } from '../templates/plan-downgrade-email.js';

// Lazy initialization of Stripe
const getStripe = () => {
  if (!stripeConfig.secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return new Stripe(stripeConfig.secretKey);
};

/**
 * Find user from Stripe customer ID (fallback when metadata is missing)
 */
const findUserByCustomerId = async (customerId) => {
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
  static async createCustomer(userEmail, userName) {
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
    amount,
    currency,
    customerId,
    metadata = {}
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
  static async createSubscription(customerId, priceId, metadata = {}) {
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
    customerId,
    priceId,
    successUrl,
    cancelUrl,
    metadata = {}
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
    customerId,
    priceId,
    successUrl,
    cancelUrl,
    metadata = {}
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
  static async getPaymentIntent(paymentIntentId) {
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
  static async getSubscription(subscriptionId) {
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
  static async cancelSubscription(subscriptionId, immediately = false) {
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
  static async createBillingPortalSession(customerId, returnUrl) {
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
   * Idempotency is handled by checking existing records (stripeSessionId, subscriptionId, etc.)
   */
  static async handleWebhookEvent(event) {
    try {
      // Replay protection - check event timestamp (Stripe events are timestamped)
      const eventAge = Date.now() - event.created * 1000; // event.created is in seconds
      const maxEventAge = 24 * 60 * 60 * 1000; // 24 hours
      if (eventAge > maxEventAge) {
        // Event is too old, likely a replay attack
        return {
          handled: false,
          message: 'Event too old, possible replay attack',
        };
      }

      // Process the event (idempotency is handled within each handler)
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
   * Handle checkout session completed (primary webhook for subscription creation)
   * This is more reliable than relying on the success page callback
   */
  static async handleCheckoutSessionCompleted(session) {
    try {
      // Only process if payment was successful
      if (session.payment_status !== 'paid') {
        return { handled: false, message: 'Payment not completed' };
      }

      const { userId, planType, duration } = session.metadata;

      if (!userId || !planType) {
        console.error('Missing metadata in checkout session:', session.id);
        return { handled: false, message: 'Missing required metadata' };
      }

      // Validate userId format (MongoDB ObjectId)
      if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
        console.error('Invalid userId format in session metadata:', userId);
        return { handled: false, message: 'Invalid userId format' };
      }

      // Validate planType
      const validPlans = ['pro', 'enterprise'];
      if (!validPlans.includes(planType)) {
        console.error('Invalid planType in session metadata:', planType);
        return { handled: false, message: 'Invalid planType' };
      }

      // Check if already processed (idempotency - additional check at handler level)
      const existingUser = await models.User.findById(userId);
      if (existingUser && existingUser.plan.stripeSessionId === session.id) {
        return {
          handled: true,
          message: 'Already processed',
          idempotent: true,
        };
      }

      // Retrieve subscription if available
      let subscriptionId = null;
      let endDate = null;
      let startDate = new Date();

      if (session.subscription) {
        const stripe = getStripe();
        const subscription =
          typeof session.subscription === 'string'
            ? await stripe.subscriptions.retrieve(session.subscription)
            : session.subscription;

        subscriptionId = subscription.id;
        endDate = new Date(subscription.current_period_end * 1000);
        startDate = new Date(subscription.current_period_start * 1000);
      } else {
        // Fallback: Calculate end date based on duration
        endDate = new Date();
        if (duration === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (duration === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }
      }

      // Update user plan
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
        // Sync all organizations owned by this user
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
  static async handlePaymentSuccess(paymentIntent) {
    try {
      const { userId, planType, duration } = paymentIntent.metadata;

      if (!userId || !planType) {
        console.error('Missing metadata in payment intent:', paymentIntent.id);
        return { handled: false };
      }

      // Calculate end date based on duration
      const endDate = new Date();
      if (duration === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (duration === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Update user plan

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
        // Also update all organizations owned by this user
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
  static async handlePaymentFailure(paymentIntent) {
    try {
      const { userId, planType } = paymentIntent.metadata;

      if (userId) {
        // Send failure notification email
        const user = await models.User.findById(userId);
        if (user) {
          try {
            const emailQueue = new EmailQueue();
            const template = getPaymentFailureEmailTemplate(
              user.name || user.email,
              planType || 'premium',
              paymentIntent.last_payment_error?.message || 'Payment could not be processed'
            );

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
            // Don't throw - email failure shouldn't break webhook processing
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
  static async handleSubscriptionCreated(subscription) {
    try {
      const { userId, planType } = subscription.metadata;

      let user = null;

      // Try metadata first
      if (userId) {
        user = await models.User.findById(userId);
      }

      // Fallback: Find by customer ID
      if (!user && subscription.customer) {
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
        user = await findUserByCustomerId(customerId);
      }

      if (user) {
        // Use subscription period dates
        const endDate = new Date(subscription.current_period_end * 1000);
        const startDate = new Date(subscription.current_period_start * 1000);

        // Determine plan type from metadata or subscription items
        let planTypeToSet = planType;
        if (!planTypeToSet && subscription.items?.data?.[0]?.price) {
          // Could extract from price ID if needed
          // For now, keep existing plan type
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

        // Sync organizations
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
  static async handleSubscriptionUpdated(subscription) {
    try {
      const { userId } = subscription.metadata;

      let user = null;

      // Try metadata first
      if (userId) {
        user = await models.User.findById(userId);
      }

      // Fallback: Find by customer ID or existing subscription ID
      if (!user) {
        if (subscription.customer) {
          const customerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer.id;
          user = await findUserByCustomerId(customerId);
        }

        // Also try by subscription ID
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

        const updateData = {
          'plan.status': status,
          $inc: { tokenVersion: 1 },
        };

        // Update endDate if subscription is active and has period end
        if (
          subscription.status === 'active' &&
          subscription.current_period_end
        ) {
          updateData['plan.endDate'] = new Date(
            subscription.current_period_end * 1000
          );
        }

        // Update cancel_at_period_end flag if needed
        if (subscription.cancel_at_period_end) {
          updateData['plan.status'] = 'active'; // Still active until period end
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
  static async handleSubscriptionDeleted(subscription) {
    try {
      const { userId } = subscription.metadata;

      let user = null;

      // Try metadata first
      if (userId) {
        user = await models.User.findById(userId);
      }

      // Fallback: Find by subscription ID or customer ID
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
        // Store previous plan type before downgrade
        const previousPlanType = user.plan?.type || 'pro';

        // Downgrade to free plan when subscription is deleted
        await models.User.findByIdAndUpdate(user._id, {
          'plan.type': 'free',
          'plan.status': 'active',
          'plan.stripeSubscriptionId': null,
          'plan.endDate': null,
          'plan.startDate': new Date(),
          $inc: { tokenVersion: 1 },
        });

        // Also downgrade all organizations owned by this user
        await models.Organization.updateMany(
          { ownerId: user._id },
          {
            'plan.type': 'free',
            'plan.status': 'active',
            'plan.startDate': new Date(),
            'plan.endDate': null,
          }
        );

        // Sync organizations to reflect cancelled status
        await OrganizationPlanSyncService.syncUserOrganizations(user._id);

        // Send downgrade email notification
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
          // Don't fail the webhook if email fails
        }
      }

      return { handled: true };
    } catch (error) {
      console.error('Error handling subscription deleted:', error);
      throw error;
    }
  }

  /**
   * Handle successful invoice payment (subscription renewal)
   */
  static async handleInvoicePaymentSucceeded(invoice) {
    try {
      const stripe = getStripe();
      const { userId } = invoice.metadata;

      let user = null;

      // Try metadata first
      if (userId) {
        user = await models.User.findById(userId);
      }

      // Fallback: Find by customer ID
      if (!user && invoice.customer) {
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer.id;
        user = await findUserByCustomerId(customerId);
      }

      if (user && invoice.subscription) {
        // Retrieve subscription to get current period end
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );

        // Update endDate to subscription's current_period_end
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

        // Sync organizations to reflect renewed plan
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
   * Sets status to past_due and allows grace period before downgrade
   */
  static async handleInvoicePaymentFailed(invoice) {
    try {
      const { userId } = invoice.metadata;

      let user = null;

      // Try metadata first
      if (userId) {
        user = await models.User.findById(userId);
      }

      // Fallback: Find by customer ID
      if (!user && invoice.customer) {
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer.id;
        user = await findUserByCustomerId(customerId);
      }

      if (user) {
        // Set to past_due status (allows grace period)
        // Actual downgrade will happen after grace period expires
        await models.User.findByIdAndUpdate(user._id, {
          'plan.status': 'past_due',
          $inc: { tokenVersion: 1 },
        });

        // TODO: Send payment failure notification email
        // TODO: Schedule downgrade after grace period (3 days)
      }

      return { handled: true };
    } catch (error) {
      console.error('Error handling invoice payment failed:', error);
      throw error;
    }
  }
}
