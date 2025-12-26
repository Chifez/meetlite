import { AuditLog } from '@minimeet/shared-models';

/**
 * Audit Logging Service
 * Records all security-relevant events for compliance and debugging
 */

// Allow injection of AuditLog model from service-specific connection
let auditLogModel = null;

/**
 * Set the AuditLog model to use (injected from service index.js)
 * @param {Object} model - Mongoose AuditLog model bound to service connection
 */
export const setAuditLogModel = (model) => {
  auditLogModel = model;
};

/**
 * Log an audit event
 * @param {Object} params - Audit log parameters
 * @param {string} params.userId - User who performed the action
 * @param {string} params.category - Action category
 * @param {string} params.action - Action performed
 * @param {string} params.status - Action status (success/failure/warning)
 * @param {string} params.resourceType - Type of resource affected
 * @param {string} params.resourceId - ID of resource affected
 * @param {string} params.details - Action details
 * @param {Object} params.metadata - Additional metadata
 * @param {Object} params.error - Error information
 * @param {string} params.ipAddress - Client IP address
 * @param {string} params.userAgent - Client user agent
 * @param {number} params.duration - Action duration in milliseconds
 * @returns {Promise<AuditLog>}
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
}) => {
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
 * @returns {Promise<Array>}
 */
export const queryAuditLogs = async (filters = {}, limit = 100, skip = 0) => {
  try {
    const query = {};

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
export const getAuditStats = async (filters = {}) => {
  try {
    const query = {};

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
      byStatus: byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byCategory: byCategory.reduce((acc, item) => {
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

export const auditNotificationScheduled = (userId, notificationId, meetingId, scheduledAt) => {
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

export const auditNotificationSent = (userId, notificationId, channels) => {
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

export const auditNotificationFailed = (userId, notificationId, error) => {
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

export const auditNotificationCancelled = (userId, notificationId, reason) => {
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

export const auditMeetingAction = (userId, meetingId, action, details, status = 'success') => {
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

