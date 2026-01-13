import { getPriceId, getPlanConfig } from '../config/stripe.js';

/**
 * Validate plan type input
 */
export const validatePlanType = (req, res, next) => {
  const { planType, duration = 'monthly' } = req.body;

  if (!planType) {
    return res.status(400).json({
      success: false,
      message: 'planType is required',
    });
  }

  // Validate plan type
  const validPlans = ['pro', 'enterprise'];
  if (!validPlans.includes(planType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid plan type. Must be "pro" or "enterprise"',
    });
  }

  // Validate duration
  const validDurations = ['monthly', 'yearly'];
  if (!validDurations.includes(duration)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid duration. Must be "monthly" or "yearly"',
    });
  }

  // Verify price ID exists for this plan/duration combination
  const priceId = getPriceId(planType, duration);
  if (!priceId) {
    return res.status(400).json({
      success: false,
      message: `Price not configured for ${planType} plan (${duration})`,
    });
  }

  // Verify plan config exists
  const planConfig = getPlanConfig(planType);
  if (!planConfig) {
    return res.status(400).json({
      success: false,
      message: `Plan configuration not found for ${planType}`,
    });
  }

  // Attach validated data to request
  req.validatedPayment = {
    planType,
    duration,
    priceId,
    planConfig,
  };

  next();
};

/**
 * Validate user ownership - ensure user can only create payments for themselves
 */
export const validateUserOwnership = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // Check if request is trying to create payment for different user
  const { userId } = req.body;
  if (userId && userId !== user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only create payments for your own account',
    });
  }

  next();
};

/**
 * Validate session ID format (Stripe session IDs)
 */
export const validateSessionId = (req, res, next) => {
  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'session_id is required',
    });
  }

  // Stripe session IDs start with 'cs_' for checkout sessions
  if (!session_id.startsWith('cs_')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid session ID format',
    });
  }

  // Basic length validation (Stripe IDs are typically 50-60 chars)
  if (session_id.length < 50 || session_id.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid session ID length',
    });
  }

  next();
};

