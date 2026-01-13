import express from 'express';
import { authenticateToken } from '../../middleware/authenticate-token.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import {
  paymentRateLimiter,
  webhookRateLimiter,
} from '../../middleware/payment-rate-limiter.js';
import {
  validatePlanType,
  validateUserOwnership,
  validateSessionId,
} from '../../middleware/payment-validation.js';
import PaymentController from '../../controllers/payment.controller.js';

const router = express.Router();
const paymentController = new PaymentController();

// POST /payment/webhook - Stripe webhook (no auth required, but rate limited)
router.post(
  '/webhook',
  webhookRateLimiter,
  express.raw({ type: 'application/json' }), // Raw body for webhook verification
  asyncHandler(paymentController.handleWebhook.bind(paymentController))
);

// GET /payment/success - Handle successful payment (no auth required - verified via session metadata)
router.get(
  '/success',
  validateSessionId,
  asyncHandler(paymentController.handlePaymentSuccess.bind(paymentController))
);

// All other routes require authentication
router.use(authenticateToken);

// POST /payment/create-customer - Create Stripe customer
router.post(
  '/create-customer',
  paymentRateLimiter,
  validateUserOwnership,
  asyncHandler(paymentController.createCustomer.bind(paymentController))
);

// POST /payment/create-checkout-session - Create checkout session
router.post(
  '/create-checkout-session',
  paymentRateLimiter,
  validatePlanType,
  validateUserOwnership,
  asyncHandler(paymentController.createCheckoutSession.bind(paymentController))
);

// POST /payment/create-billing-portal - Create billing portal session
router.post(
  '/create-billing-portal',
  paymentRateLimiter,
  validateUserOwnership,
  asyncHandler(
    paymentController.createBillingPortalSession.bind(paymentController)
  )
);

export default router;
