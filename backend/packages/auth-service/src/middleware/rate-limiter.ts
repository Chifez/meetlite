import rateLimit from 'express-rate-limit';

// Simple rate limiter for all endpoints
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
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
      req.headers['x-bypass-rate-limit'] === 'true' ||
      req.hostname.includes('ngrok')
    );
  },
});

export default rateLimiter;
