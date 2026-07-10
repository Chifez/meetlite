import { Request, Response } from 'express';
import { prisma } from '@minimeet/shared';
import { AppError, ResponseHelpers } from '@minimeet/shared';
import { auditLog } from '../services/audit.service.js';
import {
  registerConnection,
  cleanupConnection,
  canAcceptNewConnection,
} from '../services/notification-sse.service.js';

export class NotificationController {
  /**
   * GET /notifications - Get user's notifications with pagination and filtering
   */
  async getNotifications(req: any, res: Response) {
    const userId = req.user.userId;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { userId };

    if (req.query.type) {
      query.type = req.query.type;
    }

    if (req.query.read !== undefined) {
      query.read = req.query.read === 'true';
    }

    // Get notifications with pagination
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: query,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: query }),
    ]);

    // Filter sensitive data
    const sanitizedNotifications = notifications.map((notification: any) => ({
      id: notification.id,
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
   */
  async streamNotifications(req: any, res: Response) {
    const userId = req.user.userId;

    // Check global connection limit BEFORE setting headers
    if (!canAcceptNewConnection()) {
      return res.status(503).json({
        success: false,
        message: 'Server at capacity: Maximum concurrent connections reached. Please try again later.',
        error: 'CONNECTION_LIMIT_EXCEEDED',
      });
    }

    // Set SSE headers BEFORE any writes
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    
    // CORS headers for SSE
    const origin = req.headers.origin;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const allowedOrigins = [
      frontendUrl,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Cache-Control, Connection');
    }

    // IMPORTANT: Flush headers immediately to establish SSE connection
    res.flushHeaders();

    // Register this connection
    try {
      registerConnection(userId, res);
    } catch (error: any) {
      if (error.code === 'CONNECTION_LIMIT_EXCEEDED') {
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            message: 'Server at capacity. Please try again later.',
            error: 'CONNECTION_LIMIT_EXCEEDED',
          })}\n\n`
        );
        res.end();
        return;
      }
      throw error;
    }

    // Send initial connection event
    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        userId,
        message: 'Connected to notification service',
      })}\n\n`
    );

    // Audit log
    auditLog({
      userId,
      category: 'notification',
      action: 'sse_connect',
      status: 'success',
      details: 'User connected to notification SSE stream',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((err) => {
      console.error('Failed to audit SSE connection:', err);
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log(`🔌 Client disconnected for user ${userId}`);
      cleanupConnection(userId);

      // Audit log disconnect
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
    req.on('error', (error: any) => {
      console.error(`❌ SSE request error for user ${userId}:`, error);
      cleanupConnection(userId);
    });

    // Handle response errors
    res.on('error', (error: any) => {
      console.error(`❌ SSE response error for user ${userId}:`, error);
      cleanupConnection(userId);
    });
  }

  /**
   * GET /notifications/unread-count - Get count of unread notifications
   */
  async getUnreadCount(req: any, res: Response) {
    const userId = req.user.userId;

    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
      }
    });

    return ResponseHelpers.ok(res, { count });
  }

  /**
   * PATCH /notifications/:id/read - Mark a notification as read
   */
  async markAsRead(req: any, res: Response) {
    const userId = req.user.userId;
    const notificationId = req.params.id;

    // Find notification and verify ownership
    let notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      }
    });

    if (!notification) {
      throw AppError.notFound('Notification');
    }

    // Update if not already read
    if (!notification.read) {
      notification = await prisma.notification.update({
        where: { id: notification.id },
        data: { read: true, readAt: new Date() }
      });

      // Audit log
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
      id: notification.id,
      read: notification.read,
      readAt: notification.readAt,
    });
  }

  /**
   * POST /notifications/read-all - Mark all notifications as read
   */
  async markAllAsRead(req: any, res: Response) {
    const userId = req.user.userId;

    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: {
        read: true,
        readAt: new Date(),
      }
    });

    // Audit log
    auditLog({
      userId,
      category: 'notification',
      action: 'mark_all_read',
      status: 'success',
      details: `Marked ${result.count} notifications as read`,
      metadata: { count: result.count },
    }).catch((err) => {
      console.error('Failed to audit mark all read:', err);
    });

    return ResponseHelpers.ok(res, {
      count: result.count,
    });
  }

  /**
   * DELETE /notifications/:id - Delete a notification (soft delete)
   */
  async deleteNotification(req: any, res: Response) {
    const userId = req.user.userId;
    const notificationId = req.params.id;

    // Find notification and verify ownership
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId }
    });

    if (!notification) {
      throw AppError.notFound('Notification');
    }

    // Soft delete by marking as cancelled
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: 'Deleted by user'
      }
    });

    // Audit log
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
