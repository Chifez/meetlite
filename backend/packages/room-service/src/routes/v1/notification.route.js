import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';
import { Notification } from '@minimeet/shared-models';
import { verifyToken } from '../middleware/auth.js';
import { auditLog } from '../services/audit.service.js';

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
  // Key by user ID from token
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
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
  async (req, res) => {
    try {
      const userId = req.user.id;
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
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .lean(),
        Notification.countDocuments(query),
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
        userId: req.user.id,
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
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get(
  '/unread-count',
  verifyToken,
  notificationRateLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const count = await Notification.countDocuments({
        userId,
        read: false,
      });

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      console.error('❌ Failed to get unread count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get unread count',
      });
    }
  }
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
  async (req, res) => {
    try {
      const userId = req.user.id;
      const notificationId = req.params.id;

      // Find notification and verify ownership
      const notification = await Notification.findOne({
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
        userId: req.user.id,
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
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
router.post(
  '/read-all',
  verifyToken,
  notificationRateLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await Notification.updateMany(
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
        userId: req.user.id,
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
 * DELETE /api/notifications/:id
 * Delete a notification (soft delete - mark as cancelled)
 */
router.delete(
  '/:id',
  verifyToken,
  notificationRateLimiter,
  [param('id').isMongoId(), handleValidationErrors],
  async (req, res) => {
    try {
      const userId = req.user.id;
      const notificationId = req.params.id;

      // Find notification and verify ownership
      const notification = await Notification.findOne({
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
        userId: req.user.id,
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
