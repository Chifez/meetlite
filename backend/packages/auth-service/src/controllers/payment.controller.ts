import { Response } from 'express';
import { prisma } from '@minimeet/shared';
// @ts-ignore
import { PaymentService } from '../services/payment.service.js';
import { generateJWTToken } from '../utils/generate-token.js';
import { sanitizePlan } from '../utils/sanitize-plan.js';
// @ts-ignore
import Stripe from 'stripe';
import { stripeConfig, getPriceId, isSalesLedPlan } from '../config/stripe.js';
// @ts-ignore
import { OrganizationPlanSyncService } from '../services/organization-plan-sync.service.js';

// Lazy initialization of Stripe
const getStripe = (): Stripe => {
  if (!stripeConfig.secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return new Stripe(stripeConfig.secretKey, {
    apiVersion: '2023-10-16' as any,
  });
};

export class PaymentController {
  /**
   * POST /payment/create-customer - Create Stripe customer
   */
  async createCustomer(req: any, res: Response) {
    try {
      const user = req.user;

      if (user.stripeCustomerId) {
        return res.json({
          success: true,
          customerId: user.stripeCustomerId,
          message: 'Customer already exists',
        });
      }

      const customer = await PaymentService.createCustomer(
        user.email,
        user.name
      );

      await prisma.user.update({
        where: { id: user.id || user._id },
        data: { stripeCustomerId: customer.id }
      });

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
  async createCheckoutSession(req: any, res: Response) {
    try {
      const { planType, duration = 'monthly' } = req.body;
      const user = req.user;

      if (!planType) {
        return res.status(400).json({
          success: false,
          message: 'planType is required',
        });
      }

      const validPlans = ['pro', 'enterprise'];
      if (!validPlans.includes(planType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan type',
        });
      }

      if (isSalesLedPlan(planType)) {
        return res.status(400).json({
          success: false,
          message: 'Enterprise plan requires contacting sales. Please use the Contact Sales form.',
        });
      }

      if (user.plan.type === 'enterprise' && planType === 'pro') {
        return res.status(400).json({
          success: false,
          message: 'Cannot downgrade from Enterprise to Pro',
        });
      }

      if (user.plan.type === planType && user.plan.status === 'active') {
        return res.status(400).json({
          success: false,
          message: `You already have an active ${planType} plan`,
        });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await PaymentService.createCustomer(
          user.email,
          user.name
        );
        customerId = customer.id;

        await prisma.user.update({
          where: { id: user.id || user._id },
          data: { stripeCustomerId: customerId }
        });
      }

      const priceId =
        req.validatedPayment?.priceId || getPriceId(planType, duration);
      if (!priceId) {
        return res.status(400).json({
          success: false,
          message: 'Price not found for this plan',
        });
      }

      const successUrl = stripeConfig.urls.successUrl;
      const cancelUrl = stripeConfig.urls.cancelUrl;

      const session = await PaymentService.createSubscriptionCheckoutSession(
        customerId,
        priceId,
        successUrl,
        cancelUrl,
        {
          userId: (user.id || user._id).toString(),
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
  async createBillingPortalSession(req: any, res: Response) {
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
  async handleWebhook(req: any, res: Response) {
    try {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = stripeConfig.webhookSecret;

      let event;

      console.log('[Stripe Webhook] Received webhook. sig:', sig ? 'present' : 'missing', 'endpointSecret:', endpointSecret ? 'present' : 'missing');
      try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, endpointSecret);
      } catch (err: any) {
        console.error('[Stripe Webhook] Signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      const result = await PaymentService.handleWebhookEvent(event);

      // Always respond 200 to Stripe — even for events we choose not to handle.
      // Returning 4xx for unhandled events causes Stripe to retry for up to 3 days.
      res.json({ received: true, handled: result.handled ?? false });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * GET /payment/success - Handle successful payment
   */
  async handlePaymentSuccess(req: any, res: Response) {
    try {
      const { session_id } = req.query;

      if (!session_id) {
        return res.status(400).json({ message: 'Session ID is required' });
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id as string, {
        expand: ['subscription'],
      });

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ message: 'Payment not completed' });
      }

      const { userId, planType } = session.metadata!;

      if (!userId || !planType) {
        return res.status(400).json({ message: 'Invalid session metadata' });
      }

      if (req.user) {
        if (userId !== (req.user.id || req.user._id).toString()) {
          return res.status(403).json({
            message: 'Session does not belong to authenticated user',
          });
        }
      }

      const existingUser = await prisma.user.findUnique({ where: { id: userId } });
      if (existingUser && existingUser.stripeSessionId === session_id) {
        const newToken = generateJWTToken(existingUser);
        return res.json({
          success: true,
          message: 'Payment already processed',
          user: {
            id: existingUser.id,
            email: existingUser.email,
            plan: {
              type: existingUser.planType,
              status: existingUser.planStatus,
              startDate: existingUser.planStartDate,
              endDate: existingUser.planEndDate,
              stripeSubscriptionId: existingUser.stripeSubscriptionId,
              stripeSessionId: existingUser.stripeSessionId
            },
          },
          token: newToken,
        });
      }

      let subscriptionId: any = null;
      let endDate: Date | null = null;
      let startDate: Date | null = null;

      if (!session.subscription) {
        console.error('Checkout session missing subscription data:', session_id);
        return res.status(400).json({
          message: 'Checkout session missing subscription data - cannot determine billing dates',
        });
      }

      const subscription: any =
        typeof session.subscription === 'string'
          ? await stripe.subscriptions.retrieve(session.subscription)
          : session.subscription;

      subscriptionId = subscription.id;

      if (!subscription.current_period_end || !subscription.current_period_start) {
        console.error('Subscription missing period dates:', subscription.id);
        return res.status(400).json({
          message: 'Subscription missing required period dates from Stripe',
        });
      }

      endDate = new Date(subscription.current_period_end * 1000);
      startDate = new Date(subscription.current_period_start * 1000);

      if (isNaN(endDate.getTime()) || isNaN(startDate.getTime())) {
        console.error('Invalid subscription dates:', {
          subscriptionId: subscription.id,
          periodEnd: subscription.current_period_end,
          periodStart: subscription.current_period_start,
        });
        return res.status(400).json({
          message: 'Invalid subscription dates received from Stripe',
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          planType: planType as any,
          planStatus: 'active',
          planStartDate: startDate,
          planEndDate: endDate,
          stripeSessionId: session_id,
          ...(subscriptionId && {
            stripeSubscriptionId: subscriptionId,
          }),
          tokenVersion: { increment: 1 },
        }
      });

      if (updatedUser) {
        await OrganizationPlanSyncService.syncUserOrganizations(userId);

        const newToken = generateJWTToken(updatedUser);

        return res.json({
          success: true,
          message: 'Payment successful! Plan upgraded.',
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            plan: {
              type: updatedUser.planType,
              status: updatedUser.planStatus,
              startDate: updatedUser.planStartDate,
              endDate: updatedUser.planEndDate,
              stripeSubscriptionId: updatedUser.stripeSubscriptionId,
              stripeSessionId: updatedUser.stripeSessionId
            },
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
