import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { param, query, validationResult } from 'express-validator';
import { verifyToken } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import { NotificationController } from '../../controllers/notification.controller.js';
import { cleanupConnection } from '../../services/notification-sse.service.js';

const router = express.Router();
const notificationController = new NotificationController();

const ipKeyGenerator = (req: any): string => {
  return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
};

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
  keyGenerator: (req: any) => {
    if (req.user?.userId) {
      return req.user.userId.toString();
    }
    return ipKeyGenerator(req);
  },
});

/**
 * Rate limiter for SSE stream endpoint
 * More restrictive since SSE connections are long-lived
 * Max 3 connection attempts per minute per user to prevent connection spam
 */
const sseRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // Max 3 connection attempts per minute per user
  message: {
    success: false,
    error: 'Too many connection attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req: any) => {
    if (req.user?.userId) {
      return `sse:${req.user.userId}`;
    }
    return `sse:${ipKeyGenerator(req)}`;
  },
});

/**
 * Validation error handler
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): any => {
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
 * GET /api/v1/notifications
 * Get user's notifications with pagination and filtering
 */
router.get(
  '/',
  verifyToken as any,
  notificationRateLimiter as any,
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
 * GET /api/v1/notifications/stream
 * Server-Sent Events endpoint for real-time notifications
 */
router.get('/stream', verifyToken as any, sseRateLimiter as any, async (req: any, res: Response) => {
  try {
    await notificationController.streamNotifications(req, res);
  } catch (error) {
    console.error('❌ Failed to establish SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to establish SSE connection',
      });
    } else {
      cleanupConnection(req.user?.userId);
    }
  }
});

/**
 * GET /api/v1/notifications/unread-count
 * Get count of unread notifications
 */
router.get(
  '/unread-count',
  verifyToken as any,
  notificationRateLimiter as any,
  asyncHandler(
    notificationController.getUnreadCount.bind(notificationController)
  )
);

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a notification as read
 */
router.patch(
  '/:id/read',
  verifyToken as any,
  notificationRateLimiter as any,
  [param('id').isMongoId(), handleValidationErrors],
  asyncHandler(notificationController.markAsRead.bind(notificationController))
);

/**
 * POST /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.post(
  '/read-all',
  verifyToken as any,
  notificationRateLimiter as any,
  asyncHandler(
    notificationController.markAllAsRead.bind(notificationController)
  )
);

/**
 * DELETE /api/v1/notifications/:id
 * Delete a notification (soft delete - mark as cancelled)
 */
router.delete(
  '/:id',
  verifyToken as any,
  notificationRateLimiter as any,
  [param('id').isMongoId(), handleValidationErrors],
  asyncHandler(
    notificationController.deleteNotification.bind(notificationController)
  )
);

export default router;
