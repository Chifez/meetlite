import rateLimit from 'express-rate-limit';

// Rate limiter for admin endpoints (higher limit for admin users)
export const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each admin to 100 requests per windowMs
  // keyGenerator: (req) => req.user?.userId || req.ip,
  message: {
    success: false,
    message: 'Too many admin requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    process.env.DISABLE_RATE_LIMIT === 'true',
});

// Rate limiter for admin log endpoints (higher limit for streaming)
export const adminLogRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each admin to 200 requests per windowMs for logs
  // keyGenerator: (req) => req.user?.userId || req.ip,
  message: {
    success: false,
    message: 'Too many log requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    process.env.DISABLE_RATE_LIMIT === 'true',
});

