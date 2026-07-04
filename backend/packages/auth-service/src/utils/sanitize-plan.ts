/**
 * Sanitize user plan object by removing sensitive Stripe IDs
 * This prevents exposing stripeSessionId and stripePaymentIntentId to the frontend
 *
 * @param {any} plan - The plan object (can be Mongoose document or plain object)
 * @returns {any} - Sanitized plan object without sensitive Stripe IDs
 */
export const sanitizePlan = (plan: any): any => {
  if (!plan) {
    return plan;
  }

  // Convert Mongoose document to plain object if needed
  const planObj = plan.toObject ? plan.toObject() : plan;

  // Exclude sensitive Stripe IDs
  const { stripeSessionId, stripePaymentIntentId, ...safePlan } = planObj;

  return safePlan;
};
