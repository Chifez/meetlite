import Stripe from 'stripe';
import { stripeConfig } from '../config/stripe.js';
import { models } from '../index.js';
import { OrganizationPlanSyncService } from './organization-plan-sync.service.js';

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
   * Handle webhook events
   */
  static async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          // Handle checkout session completion (more reliable than success page)
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
        return { handled: false };
      }

      const { userId, planType, duration } = session.metadata;

      if (!userId || !planType) {
        console.error('Missing metadata in checkout session:', session.id);
        return { handled: false };
      }

      // Check if already processed (idempotency)
      const existingUser = await models.User.findById(userId);
      if (existingUser && existingUser.plan.stripeSessionId === session.id) {
        return { handled: true, message: 'Already processed' };
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
      const { userId } = paymentIntent.metadata;

      if (userId) {
        // Send failure notification email
        const user = await models.User.findById(userId);
        if (user) {
          // Send payment failure email
          // Implementation would go here
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
        await models.User.findByIdAndUpdate(user._id, {
          'plan.status': 'cancelled',
          'plan.stripeSubscriptionId': null,
          $inc: { tokenVersion: 1 },
        });

        // Sync organizations to reflect cancelled status
        await OrganizationPlanSyncService.syncUserOrganizations(user._id);
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
