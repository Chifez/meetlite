import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { param, query, validationResult } from 'express-validator';
import { models } from '../../index.js';
import { verifyToken } from '../../middleware/auth.js';
import { auditLog } from '../../services/audit.service.js';
import {
  registerConnection,
  cleanupConnection,
} from '../../services/notification-sse.service.js';

const router = express.Router();

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
      error: 'Validation failed',
      details: errors.array(),
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
  verifyToken,
  notificationRateLimiter,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('type').optional().trim(),
    query('read').optional().isBoolean().toBoolean(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      const skip = (page - 1) * limit;

      // Build query
      const query = { userId };

      if (req.query.type) {
        query.type = req.query.type;
      }

      if (req.query.read !== undefined) {
        query.read = req.query.read;
      }

      // Get notifications with pagination
      const [notifications, total] = await Promise.all([
        models.Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .lean(),
        models.Notification.countDocuments(query),
      ]);

      // Filter sensitive data
      const sanitizedNotifications = notifications.map((notification) => ({
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        status: notification.status,
        read: notification.read,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      }));

      res.json({
        success: true,
        data: {
          notifications: sanitizedNotifications,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: skip + notifications.length < total,
          },
        },
      });
    } catch (error) {
      console.error('❌ Failed to fetch notifications:', error);

      await auditLog({
        userId: req.user.userId,
        category: 'notification',
        action: 'fetch_notifications',
        status: 'failure',
        details: 'Failed to fetch notifications',
        error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications',
      });
    }
  }
);

/**
 * GET /api/v1/notifications/stream
 * Server-Sent Events endpoint for real-time notifications
 */
router.get('/stream', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Set SSE headers BEFORE any writes
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    // Note: CORS is handled by API Gateway - don't override here

    // IMPORTANT: Flush headers immediately to establish SSE connection
    res.flushHeaders();

    // Register this connection
    registerConnection(userId, res);

    // Send initial connection event
    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        userId,
        message: 'Connected to notification service',
      })}\n\n`
    );

    // Audit log (non-blocking - don't await to avoid blocking SSE connection)
    auditLog({
      userId,
      category: 'notification',
      action: 'sse_connect',
      status: 'success',
      details: 'User connected to notification SSE stream',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((err) => {
      // Log error but don't block
      console.error('Failed to audit SSE connection:', err);
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log(`🔌 Client disconnected for user ${userId}`);
      cleanupConnection(userId);

      // Audit log disconnect (non-blocking)
      auditLog({
        userId,
        category: 'notification',
        action: 'sse_disconnect',
        status: 'success',
        details: 'User disconnected from notification SSE stream',
      }).catch((err) => {
        console.error('Failed to audit SSE disconnect:', err);
      });
    });

    // Handle request errors
    req.on('error', (error) => {
      console.error(`❌ SSE request error for user ${userId}:`, error);
      cleanupConnection(userId);
    });

    // Handle response errors
    res.on('error', (error) => {
      console.error(`❌ SSE response error for user ${userId}:`, error);
      cleanupConnection(userId);
    });

    // IMPORTANT: Don't let the handler complete - keep connection alive
    // The connection will stay open until client disconnects or error occurs
  } catch (error) {
    console.error('❌ Failed to establish SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to establish SSE connection',
      });
    } else {
      // Headers already sent, just cleanup
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
  verifyToken,
  notificationRateLimiter,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      const count = await models.Notification.countDocuments({
        userId,
        read: false,
      });

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      console.error('❌ Failed to get unread count:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get unread count',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a notification as read
 */
router.patch(
  '/:id/read',
  verifyToken,
  notificationRateLimiter,
  [param('id').isMongoId(), handleValidationErrors],
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const notificationId = req.params.id;

      // Find notification and verify ownership
      const notification = await models.Notification.findOne({
        _id: notificationId,
        userId,
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
      }

      // Update if not already read
      if (!notification.read) {
        notification.read = true;
        notification.readAt = new Date();
        await notification.save();

        await auditLog({
          userId,
          category: 'notification',
          action: 'mark_read',
          status: 'success',
          resourceType: 'notification',
          resourceId: notificationId,
          details: 'Notification marked as read',
        });
      }

      res.json({
        success: true,
        data: {
          id: notification._id,
          read: notification.read,
          readAt: notification.readAt,
        },
      });
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);

      await auditLog({
        userId: req.user.userId,
        category: 'notification',
        action: 'mark_read',
        status: 'failure',
        resourceType: 'notification',
        resourceId: req.params.id,
        details: 'Failed to mark notification as read',
        error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read',
      });
    }
  }
);

/**
 * POST /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.post(
  '/read-all',
  verifyToken,
  notificationRateLimiter,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      const result = await models.Notification.updateMany(
        { userId, read: false },
        {
          $set: {
            read: true,
            readAt: new Date(),
          },
        }
      );

      await auditLog({
        userId,
        category: 'notification',
        action: 'mark_all_read',
        status: 'success',
        details: `Marked ${result.modifiedCount} notifications as read`,
        metadata: { count: result.modifiedCount },
      });

      res.json({
        success: true,
        data: {
          count: result.modifiedCount,
        },
      });
    } catch (error) {
      console.error('❌ Failed to mark all as read:', error);

      await auditLog({
        userId: req.user.userId,
        category: 'notification',
        action: 'mark_all_read',
        status: 'failure',
        details: 'Failed to mark all notifications as read',
        error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to mark all notifications as read',
      });
    }
  }
);

/**
 * DELETE /api/v1/notifications/:id
 * Delete a notification (soft delete - mark as cancelled)
 */
router.delete(
  '/:id',
  verifyToken,
  notificationRateLimiter,
  [param('id').isMongoId(), handleValidationErrors],
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const notificationId = req.params.id;

      // Find notification and verify ownership
      const notification = await models.Notification.findOne({
        _id: notificationId,
        userId,
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
      }

      // Soft delete by marking as cancelled
      notification.status = 'cancelled';
      notification.cancelledAt = new Date();
      notification.cancelReason = 'Deleted by user';
      await notification.save();

      await auditLog({
        userId,
        category: 'notification',
        action: 'delete',
        status: 'success',
        resourceType: 'notification',
        resourceId: notificationId,
        details: 'Notification deleted by user',
      });

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      console.error('❌ Failed to delete notification:', error);

      await auditLog({
        userId: req.user.userId,
        category: 'notification',
        action: 'delete',
        status: 'failure',
        resourceType: 'notification',
        resourceId: req.params.id,
        details: 'Failed to delete notification',
        error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete notification',
      });
    }
  }
);

export default router;
