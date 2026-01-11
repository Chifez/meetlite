import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    // User who performed the action
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Action category
    category: {
      type: String,
      enum: [
        'notification',
        'meeting',
        'auth',
        'payment',
        'calendar',
        'recording',
        'system',
      ],
      required: true,
      index: true,
    },

    // Action performed
    action: {
      type: String,
      required: true,
      index: true,
      maxlength: 100,
    },

    // Resource affected
    resourceType: {
      type: String,
      maxlength: 50,
    },

    resourceId: {
      type: String,
      index: true,
    },

    // Action details
    status: {
      type: String,
      enum: ['success', 'failure', 'warning'],
      required: true,
      index: true,
    },

    details: {
      type: String,
      maxlength: 2000,
    },

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Request information
    ipAddress: {
      type: String,
    },

    userAgent: {
      type: String,
    },

    // Error information (if applicable)
    error: {
      message: String,
      code: String,
      stack: String,
    },

    // Performance tracking
    duration: {
      type: Number, // in milliseconds
    },

    // TTL for auto-cleanup
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ status: 1, createdAt: -1 });

// TTL index for auto-cleanup (1 year retention)
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Set expiration date on creation
auditLogSchema.pre('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    // Audit logs expire after 1 year
    this.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Model factory for multi-database support
export const createAuditLogModel = (connection) => {
  return connection.model('AuditLog', auditLogSchema);
};

// Default export for single database
const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;

