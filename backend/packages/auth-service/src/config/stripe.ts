import dotenv from 'dotenv';

dotenv.config();

/**
 * Stripe Configuration
 */

export const stripeConfig: any = {
  // API Keys
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  // Price IDs for different plans and durations
  priceIds: {
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    },
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
 */
export function getPriceId(planType: string, duration: string): string | null {
  return stripeConfig.priceIds[planType]?.[duration] || null;
}

/**
 * Get plan configuration
 */
export function getPlanConfig(planType: string): any | null {
  return stripeConfig.plans[planType] || null;
}

/**
 * Validate Stripe configuration
 */
export function validateStripeConfig() {
  const missing: string[] = [];

  if (!stripeConfig.secretKey) missing.push('STRIPE_SECRET_KEY');
  if (!stripeConfig.webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET');

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
 */
export function isSalesLedPlan(planType: string): boolean {
  return stripeConfig.plans[planType]?.isSalesLed === true;
}

export default stripeConfig;
