import dotenv from 'dotenv';

dotenv.config();

/**
 * Stripe Configuration
 *
 * This file contains all Stripe-related configuration including:
 * - API keys
 * - Price IDs for different plans
 * - Webhook secrets
 * - Environment-specific settings
 */

export const stripeConfig = {
  // API Keys
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  // Price IDs for different plans and durations
  // Note: Enterprise is sales-led only - no direct checkout
  priceIds: {
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    },
    // Enterprise has no price IDs - sales-led only
  },

  // Plan configurations
  plans: {
    pro: {
      name: 'Pro',
      monthlyPrice: 19,
      yearlyPrice: 190,
      features: [
        'Up to 10 organizations',
        'Up to 50 team members',
        'Advanced analytics',
        'Priority support',
        'Custom branding',
        'API access',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      // No monthlyPrice or yearlyPrice - sales-led only (custom pricing)
      isSalesLed: true,
      features: [
        'Unlimited organizations',
        'Unlimited team members',
        'Advanced security',
        '24/7 dedicated support',
        'Custom integrations',
        'SSO & SAML',
        'Advanced compliance',
      ],
    },
  },

  // URLs
  urls: {
    successUrl: `${
      process.env.CLIENT_URL || 'http://localhost:5174'
    }/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${process.env.CLIENT_URL || 'http://localhost:5174'}/settings`,
  },
};

/**
 * Get price ID for a specific plan and duration
 * @param {string} planType - 'pro' or 'enterprise'
 * @param {string} duration - 'monthly' or 'yearly'
 * @returns {string|null} Price ID or null if not found
 */
export function getPriceId(planType, duration) {
  return stripeConfig.priceIds[planType]?.[duration] || null;
}

/**
 * Get plan configuration
 * @param {string} planType - 'pro' or 'enterprise'
 * @returns {Object|null} Plan configuration or null if not found
 */
export function getPlanConfig(planType) {
  return stripeConfig.plans[planType] || null;
}

/**
 * Validate Stripe configuration
 * @returns {Object} Validation result with isValid and missing fields
 */
export function validateStripeConfig() {
  const missing = [];

  if (!stripeConfig.secretKey) missing.push('STRIPE_SECRET_KEY');
  if (!stripeConfig.webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET');

  // Check Pro price IDs only (Enterprise is sales-led, no direct checkout)
  const proPrices = stripeConfig.priceIds.pro;
  if (proPrices) {
    if (!proPrices.monthly) missing.push('STRIPE_PRO_MONTHLY_PRICE_ID');
    if (!proPrices.yearly) missing.push('STRIPE_PRO_YEARLY_PRICE_ID');
  }

  return {
    isValid: missing.length === 0,
    missing,
  };
}

/**
 * Check if a plan is sales-led (no direct checkout)
 * @param {string} planType - 'pro' or 'enterprise'
 * @returns {boolean} True if plan is sales-led
 */
export function isSalesLedPlan(planType) {
  return stripeConfig.plans[planType]?.isSalesLed === true;
}

export default stripeConfig;
