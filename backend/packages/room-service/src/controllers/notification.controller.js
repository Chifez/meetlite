import { models } from '../index.js';
import { AppError, ResponseHelpers } from '@minimeet/shared';
import { auditLog } from '../services/audit.service.js';
import {
  registerConnection,
  cleanupConnection,
} from '../services/notification-sse.service.js';

export class NotificationController {
  /**
   * GET /notifications - Get user's notifications with pagination and filtering
   */
  async getNotifications(req, res) {
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

    // Audit log (non-blocking)
    auditLog({
      userId,
      category: 'notification',
      action: 'fetch_notifications',
      status: 'success',
      details: 'Fetched notifications',
      metadata: { page, limit, total },
    }).catch((err) => {
      console.error('Failed to audit notification fetch:', err);
    });

    return ResponseHelpers.ok(res, {
      notifications: sanitizedNotifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + notifications.length < total,
      },
    });
  }

  /**
   * GET /notifications/stream - Server-Sent Events endpoint for real-time notifications
   * Note: This handler needs special handling for SSE, so it keeps try-catch for headers
   */
  async streamNotifications(req, res) {
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
    // Note: This handler doesn't return, so errors are handled by event listeners above
  }

  /**
   * GET /notifications/unread-count - Get count of unread notifications
   */
  async getUnreadCount(req, res) {
    const userId = req.user.userId;

    const count = await models.Notification.countDocuments({
      userId,
      read: false,
    });

    return ResponseHelpers.ok(res, { count });
  }

  /**
   * PATCH /notifications/:id/read - Mark a notification as read
   */
  async markAsRead(req, res) {
    const userId = req.user.userId;
    const notificationId = req.params.id;

    // Find notification and verify ownership
    const notification = await models.Notification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      throw AppError.notFound('Notification');
    }

    // Update if not already read
    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();

      // Audit log (non-blocking)
      auditLog({
        userId,
        category: 'notification',
        action: 'mark_read',
        status: 'success',
        resourceType: 'notification',
        resourceId: notificationId,
        details: 'Notification marked as read',
      }).catch((err) => {
        console.error('Failed to audit mark read:', err);
      });
    }

    return ResponseHelpers.ok(res, {
      id: notification._id,
      read: notification.read,
      readAt: notification.readAt,
    });
  }

  /**
   * POST /notifications/read-all - Mark all notifications as read
   */
  async markAllAsRead(req, res) {
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

    // Audit log (non-blocking)
    auditLog({
      userId,
      category: 'notification',
      action: 'mark_all_read',
      status: 'success',
      details: `Marked ${result.modifiedCount} notifications as read`,
      metadata: { count: result.modifiedCount },
    }).catch((err) => {
      console.error('Failed to audit mark all read:', err);
    });

    return ResponseHelpers.ok(res, {
      count: result.modifiedCount,
    });
  }

  /**
   * DELETE /notifications/:id - Delete a notification (soft delete)
   */
  async deleteNotification(req, res) {
    const userId = req.user.userId;
    const notificationId = req.params.id;

    // Find notification and verify ownership
    const notification = await models.Notification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      throw AppError.notFound('Notification');
    }

    // Soft delete by marking as cancelled
    notification.status = 'cancelled';
    notification.cancelledAt = new Date();
    notification.cancelReason = 'Deleted by user';
    await notification.save();

    // Audit log (non-blocking)
    auditLog({
      userId,
      category: 'notification',
      action: 'delete',
      status: 'success',
      resourceType: 'notification',
      resourceId: notificationId,
      details: 'Notification deleted by user',
    }).catch((err) => {
      console.error('Failed to audit delete:', err);
    });

    return ResponseHelpers.ok(res, null, 'Notification deleted successfully');
  }
}

