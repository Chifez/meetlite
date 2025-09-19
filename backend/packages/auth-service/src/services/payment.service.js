import Stripe from 'stripe';
import { stripeConfig } from '../config/stripe.js';

// Lazy initialization of Stripe
const getStripe = () => {
  if (!stripeConfig.secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return new Stripe(stripeConfig.secretKey);
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
          console.log(`Unhandled event type: ${event.type}`);
          return { handled: false };
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
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
      const { models } = await import('../index.js');
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

        console.log(
          `Plan upgraded for user ${userId} to ${planType} and synced to owned organizations`
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
        console.log(
          `Payment failed for user ${userId}:`,
          paymentIntent.last_payment_error?.message
        );

        // Send failure notification email
        const { models } = await import('../index.js');
        const { PlanEmailService } = await import('./plan-email.service.js');

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

      if (userId && planType) {
        const { models } = await import('../index.js');
        await models.User.findByIdAndUpdate(userId, {
          'plan.stripeSubscriptionId': subscription.id,
          'plan.status': 'active',
        });

        console.log(`Subscription created for user ${userId}`);
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

      if (userId) {
        const { models } = await import('../index.js');
        const status =
          subscription.status === 'active' ? 'active' : 'cancelled';

        await models.User.findByIdAndUpdate(userId, {
          'plan.status': status,
          $inc: { tokenVersion: 1 },
        });

        console.log(`Subscription updated for user ${userId}: ${status}`);
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

      if (userId) {
        const { models } = await import('../index.js');
        await models.User.findByIdAndUpdate(userId, {
          'plan.status': 'cancelled',
          'plan.stripeSubscriptionId': null,
          $inc: { tokenVersion: 1 },
        });

        console.log(`Subscription cancelled for user ${userId}`);
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
  static async handleInvoicePaymentSucceeded(invoice) {
    try {
      const { userId } = invoice.metadata;

      if (userId) {
        const { models } = await import('../index.js');
        await models.User.findByIdAndUpdate(userId, {
          'plan.status': 'active',
          'plan.lastPaymentDate': new Date(),
        });

        console.log(`Invoice payment succeeded for user ${userId}`);
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
  static async handleInvoicePaymentFailed(invoice) {
    try {
      const { userId } = invoice.metadata;

      if (userId) {
        const { models } = await import('../index.js');
        await models.User.findByIdAndUpdate(userId, {
          'plan.status': 'past_due',
        });

        console.log(`Invoice payment failed for user ${userId}`);
      }

      return { handled: true };
    } catch (error) {
      console.error('Error handling invoice payment failed:', error);
      throw error;
    }
  }
}
