import express from 'express';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';
import {
  paymentRateLimiter,
  webhookRateLimiter,
} from '../../middleware/payment-rate-limiter.js';
import {
  validatePlanType,
  validateUserOwnership,
  validateSessionId,
// @ts-ignore
} from '../../middleware/payment-validation.js';
import PaymentController from '../../controllers/payment.controller.js';

const router = express.Router();
const paymentController = new PaymentController();

// POST /payment/webhook - Stripe webhook (no auth required, but rate limited)
router.post(
  '/webhook',
  webhookRateLimiter,
  asyncHandler(paymentController.handleWebhook.bind(paymentController))
);

// GET /payment/success - Handle successful payment
router.get(
  '/success',
  validateSessionId,
  asyncHandler(paymentController.handlePaymentSuccess.bind(paymentController))
);

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
