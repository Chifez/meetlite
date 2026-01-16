import rateLimit from 'express-rate-limit';

/**
 * Rate limiter specifically for payment endpoints
 * More restrictive than general rate limiter
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 payment requests per 15 minutes
  message: {
    success: false,
    message: 'Too many payment requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const env = process.env.NODE_ENV;
    const disableRateLimit = process.env.DISABLE_RATE_LIMIT === 'true';
    return (
      env === 'development' ||
      env === 'test' ||
      disableRateLimit ||
      req.headers['x-bypass-rate-limit'] === 'true'
    );
  },
  // Use user ID if available for better rate limiting
  // keyGenerator: (req) => {
  //   return req.user?._id?.toString() || req.ip;
  // },
});

/**
 * Rate limiter for webhook endpoint (very permissive for Stripe)
 * Webhooks are already secured via signature verification
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Allow up to 100 webhook events per minute
  message: {
    success: false,
    message: 'Too many webhook requests',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only skip in development/test
    const env = process.env.NODE_ENV;
    return env === 'development' || env === 'test';
  },
});
