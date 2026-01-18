import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { validationResult } from 'express-validator';
import { ContactController } from '../../controllers/contact.controller.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import { validateContactSales } from '../../middleware/validation.js';

const router = express.Router();
const contactController = new ContactController();

/**
 * Rate limiter for contact endpoints
 * 5 submissions per hour per IP to prevent spam
 */
const contactRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 submissions per hour per IP
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Key by IP address
  keyGenerator: (req) => {
    return ipKeyGenerator(req);
  },
  skipSuccessfulRequests: false,
});

/**
 * Validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * POST /api/v1/contact/sales
 * Submit contact sales form
 * Public endpoint - no authentication required
 */
router.post(
  '/sales',
  contactRateLimiter,
  [...validateContactSales, handleValidationErrors],
  asyncHandler(contactController.contactSales.bind(contactController))
);

export default router;

