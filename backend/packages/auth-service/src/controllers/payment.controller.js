import { models } from '../index.js';
import { PaymentService } from '../services/payment.service.js';
import { generateJWTToken } from '../utils/generate-token.js';
import Stripe from 'stripe';
import { stripeConfig, getPriceId } from '../config/stripe.js';

// Lazy initialization of Stripe
const getStripe = () => {
  if (!stripeConfig.secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return new Stripe(stripeConfig.secretKey);
};

export class PaymentController {
  /**
   * POST /payment/create-customer - Create Stripe customer
   */
  async createCustomer(req, res) {
    try {
      const user = req.user;

      // Check if user already has a Stripe customer ID
      if (user.stripeCustomerId) {
        return res.json({
          success: true,
          customerId: user.stripeCustomerId,
          message: 'Customer already exists',
        });
      }

      // Create Stripe customer
      const customer = await PaymentService.createCustomer(
        user.email,
        user.name
      );

      // Update user with Stripe customer ID
      const updatedUser = await models.User.findByIdAndUpdate(
        user._id,
        { stripeCustomerId: customer.id },
        { new: true }
      );

      res.json({
        success: true,
        customerId: customer.id,
        message: 'Customer created successfully',
      });
    } catch (error) {
      console.error('Create customer error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * POST /payment/create-checkout-session - Create checkout session for plan upgrade
   */
  async createCheckoutSession(req, res) {
    try {
      const { planType, duration = 'monthly' } = req.body;
      const user = req.user;

      if (!planType) {
        return res.status(400).json({ message: 'planType is required' });
      }

      // Validate plan type
      const validPlans = ['pro', 'enterprise'];
      if (!validPlans.includes(planType)) {
        return res.status(400).json({ message: 'Invalid plan type' });
      }

      // Get or create Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await PaymentService.createCustomer(
          user.email,
          user.name
        );
        customerId = customer.id;

        // Update user with customer ID
        await models.User.findByIdAndUpdate(user._id, {
          stripeCustomerId: customerId,
        });
      }

      // Get price ID based on plan and duration
      const priceId = getPriceId(planType, duration);
      if (!priceId) {
        return res
          .status(400)
          .json({ message: 'Price not found for this plan' });
      }

      // Create checkout session
      const successUrl = stripeConfig.urls.successUrl;
      const cancelUrl = stripeConfig.urls.cancelUrl;

      const session = await PaymentService.createSubscriptionCheckoutSession(
        customerId,
        priceId,
        successUrl,
        cancelUrl,
        {
          userId: user._id.toString(),
          planType,
          duration,
          userEmail: user.email,
        }
      );

      res.json({
        success: true,
        sessionId: session.id,
        url: session.url,
      });
    } catch (error) {
      console.error('Create checkout session error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * POST /payment/create-billing-portal - Create billing portal session
   */
  async createBillingPortalSession(req, res) {
    try {
      const user = req.user;

      if (!user.stripeCustomerId) {
        return res.status(400).json({
          message:
            'No billing information found. Please upgrade your plan first.',
        });
      }

      const returnUrl = `${process.env.FRONTEND_URL}/settings`;
      const session = await PaymentService.createBillingPortalSession(
        user.stripeCustomerId,
        returnUrl
      );

      res.json({
        success: true,
        url: session.url,
      });
    } catch (error) {
      console.error('Create billing portal session error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * POST /payment/webhook - Handle Stripe webhooks
   */
  async handleWebhook(req, res) {
    try {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = stripeConfig.webhookSecret;

      let event;

      try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle the event
      const result = await PaymentService.handleWebhookEvent(event);

      if (result.handled) {
        res.json({ received: true });
      } else {
        res.status(400).json({ received: false, message: 'Event not handled' });
      }
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * GET /payment/success - Handle successful payment
   */
  async handlePaymentSuccess(req, res) {
    try {
      const { session_id } = req.query;

      if (!session_id) {
        return res.status(400).json({ message: 'Session ID is required' });
      }

      // Retrieve the session
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status === 'paid') {
        const { userId, planType, duration } = session.metadata;

        if (userId && planType) {
          // Calculate end date
          const endDate = new Date();
          if (duration === 'monthly') {
            endDate.setMonth(endDate.getMonth() + 1);
          } else if (duration === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
          }

          // Update user plan
          const updatedUser = await models.User.findByIdAndUpdate(
            userId,
            {
              'plan.type': planType,
              'plan.status': 'active',
              'plan.startDate': new Date(),
              'plan.endDate': endDate,
              'plan.stripeSessionId': session_id,
              $inc: { tokenVersion: 1 },
            },
            { new: true }
          );

          if (updatedUser) {
            // Generate new token
            const newToken = generateJWTToken(updatedUser);

            res.json({
              success: true,
              message: 'Payment successful! Plan upgraded.',
              user: {
                id: updatedUser._id,
                email: updatedUser.email,
                plan: updatedUser.plan,
              },
              token: newToken,
            });
          } else {
            res.status(404).json({ message: 'User not found' });
          }
        } else {
          res.status(400).json({ message: 'Invalid session metadata' });
        }
      } else {
        res.status(400).json({ message: 'Payment not completed' });
      }
    } catch (error) {
      console.error('Payment success error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

export default PaymentController;
