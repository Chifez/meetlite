import express, { Request, Response, NextFunction } from 'express';
// @ts-ignore
import rateLimit from 'express-rate-limit';
// @ts-ignore
import { validationResult } from 'express-validator';
import { ContactController } from '../../controllers/contact.controller.js';
// @ts-ignore
import { asyncHandler } from '../../middleware/error-handler.js';
// @ts-ignore
import { validateContactSales } from '../../middleware/validation.js';

const router = express.Router();
const contactController = new ContactController();

const contactRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || '';
  },
  skipSuccessfulRequests: false,
});

const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
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

router.post(
  '/sales',
  contactRateLimiter as any,
  [...validateContactSales, handleValidationErrors],
  asyncHandler(contactController.contactSales.bind(contactController))
);

export default router;
