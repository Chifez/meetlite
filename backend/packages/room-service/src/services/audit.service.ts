import { AuditLog } from '@minimeet/shared';

/**
 * Audit Logging Service
 * Records all security-relevant events for compliance and debugging
 */

// Allow injection of AuditLog model from service-specific connection
let auditLogModel: any = null;

/**
 * Set the AuditLog model to use (injected from service index.ts)
 * @param {any} model - Mongoose AuditLog model bound to service connection
 */
export const setAuditLogModel = (model: any) => {
  auditLogModel = model;
};

interface AuditLogParams {
  userId?: string;
  category: string;
  action: string;
  status?: string;
  resourceType?: string;
  resourceId?: string;
  details?: string;
  metadata?: any;
  error?: any;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
}

/**
 * Log an audit event
 * @param {AuditLogParams} params - Audit log parameters
 * @returns {Promise<any>}
 */
export const auditLog = async ({
  userId,
  category,
  action,
  status = 'success',
  resourceType,
  resourceId,
  details,
  metadata = {},
  error,
  ipAddress,
  userAgent,
  duration,
}: AuditLogParams): Promise<any> => {
  try {
    // Use injected model if available, otherwise fallback to default export
    const modelToUse = auditLogModel || AuditLog;
    
    const log = await modelToUse.create({
      userId,
      category,
      action,
      status,
      resourceType,
      resourceId,
      details,
      metadata,
      error: error
        ? {
            message: error.message,
            code: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          }
        : undefined,
      ipAddress,
      userAgent,
      duration,
    });

    // Only log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[AUDIT] ${status.toUpperCase()} - ${category}:${action} by user ${userId || 'system'}`
      );
    }

    return log;
  } catch (err) {
    // Don't throw - audit logging failure shouldn't break the app
    console.error('❌ Failed to create audit log:', err);
    return null;
  }
};

/**
 * Query audit logs with filters
 * @param {Object} filters - Query filters
 * @param {number} limit - Result limit
 * @param {number} skip - Result skip
 * @returns {Promise<Array<any>>}
 */
export const queryAuditLogs = async (filters: any = {}, limit = 100, skip = 0): Promise<any[]> => {
  try {
    const query: any = {};

    if (filters.userId) query.userId = filters.userId;
    if (filters.category) query.category = filters.category;
    if (filters.action) query.action = filters.action;
    if (filters.status) query.status = filters.status;
    if (filters.resourceType) query.resourceType = filters.resourceType;
    if (filters.resourceId) query.resourceId = filters.resourceId;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const modelToUse = auditLogModel || AuditLog;
    const logs = await modelToUse.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return logs;
  } catch (error) {
    console.error('❌ Failed to query audit logs:', error);
    throw error;
  }
};

/**
 * Get audit log statistics
 * @param {Object} filters - Query filters
 * @returns {Promise<Object>}
 */
export const getAuditStats = async (filters: any = {}): Promise<any> => {
  try {
    const query: any = {};

    if (filters.userId) query.userId = filters.userId;
    if (filters.category) query.category = filters.category;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const modelToUse = auditLogModel || AuditLog;
    const [total, byStatus, byCategory] = await Promise.all([
      modelToUse.countDocuments(query),
      modelToUse.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      modelToUse.aggregate([
        { $match: query },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byCategory: byCategory.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };
  } catch (error) {
    console.error('❌ Failed to get audit stats:', error);
    throw error;
  }
};

/**
 * Audit log helpers for specific actions
 */

export const auditNotificationScheduled = (userId: string, notificationId: string, meetingId: string, scheduledAt: any) => {
  return auditLog({
    userId,
    category: 'notification',
    action: 'notification_scheduled',
    status: 'success',
    resourceType: 'notification',
    resourceId: notificationId,
    details: `Meeting reminder scheduled for ${scheduledAt}`,
    metadata: { meetingId, scheduledAt },
  });
};

export const auditNotificationSent = (userId: string, notificationId: string, channels: string[]) => {
  return auditLog({
    userId,
    category: 'notification',
    action: 'notification_sent',
    status: 'success',
    resourceType: 'notification',
    resourceId: notificationId,
    details: `Notification sent via ${channels.join(', ')}`,
    metadata: { channels },
  });
};

export const auditNotificationFailed = (userId: string, notificationId: string, error: any) => {
  return auditLog({
    userId,
    category: 'notification',
    action: 'notification_failed',
    status: 'failure',
    resourceType: 'notification',
    resourceId: notificationId,
    details: `Notification failed: ${error.message}`,
    error,
  });
};

export const auditNotificationCancelled = (userId: string, notificationId: string, reason: string) => {
  return auditLog({
    userId,
    category: 'notification',
    action: 'notification_cancelled',
    status: 'success',
    resourceType: 'notification',
    resourceId: notificationId,
    details: `Notification cancelled: ${reason}`,
    metadata: { reason },
  });
};

export const auditMeetingAction = (userId: string, meetingId: string, action: string, details: string, status = 'success') => {
  return auditLog({
    userId,
    category: 'meeting',
    action,
    status,
    resourceType: 'meeting',
    resourceId: meetingId,
    details,
  });
};

export default {
  auditLog,
  queryAuditLogs,
  getAuditStats,
  auditNotificationScheduled,
  auditNotificationSent,
  auditNotificationFailed,
  auditNotificationCancelled,
  auditMeetingAction,
};
