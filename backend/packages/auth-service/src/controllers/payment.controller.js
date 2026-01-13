import { models } from '../index.js';
import { PaymentService } from '../services/payment.service.js';
import { generateJWTToken } from '../utils/generate-token.js';
import { sanitizePlan } from '../utils/sanitize-plan.js';
import Stripe from 'stripe';
import { stripeConfig, getPriceId } from '../config/stripe.js';
import { OrganizationPlanSyncService } from '../services/organization-plan-sync.service.js';

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

      // Validation is handled by middleware, but double-check
      if (!planType) {
        return res.status(400).json({ 
          success: false,
          message: 'planType is required' 
        });
      }

      // Validate plan type
      const validPlans = ['pro', 'enterprise'];
      if (!validPlans.includes(planType)) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid plan type' 
        });
      }

      // Prevent downgrades (users can only upgrade)
      if (user.plan.type === 'enterprise' && planType === 'pro') {
        return res.status(400).json({
          success: false,
          message: 'Cannot downgrade from Enterprise to Pro',
        });
      }

      // Prevent same plan upgrade
      if (user.plan.type === planType && user.plan.status === 'active') {
        return res.status(400).json({
          success: false,
          message: `You already have an active ${planType} plan`,
        });
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

      // Get price ID based on plan and duration (validated by middleware)
      const priceId = req.validatedPayment?.priceId || getPriceId(planType, duration);
      if (!priceId) {
        return res.status(400).json({ 
          success: false,
          message: 'Price not found for this plan' 
        });
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

      const returnUrl = `${
        process.env.CLIENT_URL ||
        process.env.FRONTEND_URL ||
        'http://localhost:5174'
      }/settings`;
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
   * Note: This endpoint should be called after Stripe redirects user back
   * Authentication is handled via session metadata verification
   */
  async handlePaymentSuccess(req, res) {
    try {
      const { session_id } = req.query;

      if (!session_id) {
        return res.status(400).json({ message: 'Session ID is required' });
      }

      // Retrieve the session with subscription details
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ['subscription'],
      });

      // Verify session exists and is paid
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ message: 'Payment not completed' });
      }

      const { userId, planType } = session.metadata;

      if (!userId || !planType) {
        return res.status(400).json({ message: 'Invalid session metadata' });
      }

      // SECURITY: Verify session belongs to authenticated user (if authenticated)
      // OR verify via session metadata if no auth token
      if (req.user) {
        // If user is authenticated, verify session belongs to them
        if (userId !== req.user._id.toString()) {
          return res.status(403).json({
            message: 'Session does not belong to authenticated user',
          });
        }
      }

      // Check if payment was already processed (idempotency)
      const existingUser = await models.User.findById(userId);
      if (existingUser && existingUser.plan.stripeSessionId === session_id) {
        // Payment already processed, return success but don't update again
        const newToken = generateJWTToken(existingUser);
        return res.json({
          success: true,
          message: 'Payment already processed',
          user: {
            id: existingUser._id,
            email: existingUser.email,
            plan: sanitizePlan(existingUser.plan),
          },
          token: newToken,
        });
      }

      // Retrieve subscription to get actual period end date
      let subscriptionId = null;
      let endDate = null;
      let startDate = new Date();

      if (session.subscription) {
        // Subscription mode - get actual subscription object
        const subscription =
          typeof session.subscription === 'string'
            ? await stripe.subscriptions.retrieve(session.subscription)
            : session.subscription;

        subscriptionId = subscription.id;
        // Use subscription's current_period_end as endDate (in seconds, convert to Date)
        endDate = new Date(subscription.current_period_end * 1000);
        startDate = new Date(subscription.current_period_start * 1000);
      } else {
        // Fallback: Calculate end date based on duration (shouldn't happen in subscription mode)
        const { duration = 'monthly' } = session.metadata;
        endDate = new Date();
        if (duration === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (duration === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }
      }

      // Update user plan with subscription details
      const updatedUser = await models.User.findByIdAndUpdate(
        userId,
        {
          'plan.type': planType,
          'plan.status': 'active',
          'plan.startDate': startDate,
          'plan.endDate': endDate,
          'plan.stripeSessionId': session_id,
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

        // Generate new token
        const newToken = generateJWTToken(updatedUser);

        return res.json({
          success: true,
          message: 'Payment successful! Plan upgraded.',
          user: {
            id: updatedUser._id,
            email: updatedUser.email,
            plan: sanitizePlan(updatedUser.plan),
          },
          token: newToken,
        });
      } else {
        return res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      console.error('Payment success error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

export default PaymentController;
