import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';
import { verifyToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { NotificationController } from '../controllers/notification.controller.js';

const router = express.Router();
const notificationController = new NotificationController();

/**
 * Rate limiter for notification endpoints
 * 100 requests per 15 minutes per user
 */
const notificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Key by user ID from token, fallback to IP with IPv6-safe helper
  keyGenerator: (req) => {
    // Use userId if authenticated, otherwise use IP with IPv6-safe helper
    if (req.user?.userId) {
      return req.user.userId.toString();
    }
    // Use ipKeyGenerator helper for IPv6-safe IP handling
    return ipKeyGenerator(req);
  },
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
 * GET /api/notifications
 * Get user's notifications with pagination and filtering
 */
router.get(
  '/',
  verifyToken,
  notificationRateLimiter,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('type').optional().trim(),
    query('read').optional().isBoolean().toBoolean(),
    handleValidationErrors,
  ],
  asyncHandler(
    notificationController.getNotifications.bind(notificationController)
  )
);

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get(
  '/unread-count',
  verifyToken,
  notificationRateLimiter,
  asyncHandler(
    notificationController.getUnreadCount.bind(notificationController)
  )
);

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch(
  '/:id/read',
  verifyToken,
  notificationRateLimiter,
  [param('id').isMongoId(), handleValidationErrors],
  asyncHandler(notificationController.markAsRead.bind(notificationController))
);

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
router.post(
  '/read-all',
  verifyToken,
  notificationRateLimiter,
  asyncHandler(
    notificationController.markAllAsRead.bind(notificationController)
  )
);

/**
 * DELETE /api/notifications/:id
 * Delete a notification (soft delete - mark as cancelled)
 */
router.delete(
  '/:id',
  verifyToken,
  notificationRateLimiter,
  [param('id').isMongoId(), handleValidationErrors],
  asyncHandler(
    notificationController.deleteNotification.bind(notificationController)
  )
);

export default router;
