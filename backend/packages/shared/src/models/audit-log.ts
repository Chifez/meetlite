import mongoose, { Schema, Document, Connection } from 'mongoose';

export type AuditCategory =
  | 'notification'
  | 'meeting'
  | 'auth'
  | 'payment'
  | 'calendar'
  | 'recording'
  | 'system';

export type AuditStatus = 'success' | 'failure' | 'warning';

export interface IAuditLog {
  userId?: mongoose.Types.ObjectId;
  category: AuditCategory;
  action: string;
  resourceType?: string;
  resourceId?: string;
  status: AuditStatus;
  details?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  error?: {
    message?: string;
    code?: string;
    stack?: string;
  };
  duration?: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

export const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
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
    action: {
      type: String,
      required: true,
      index: true,
      maxlength: 100,
    },
    resourceType: {
      type: String,
      maxlength: 50,
    },
    resourceId: {
      type: String,
      index: true,
    },
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
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    error: {
      message: String,
      code: String,
      stack: String,
    },
    duration: {
      type: Number,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ status: 1, createdAt: -1 });
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware
auditLogSchema.pre('save', function (this: IAuditLogDocument, next: any) {
  if (this.isNew && !this.expiresAt) {
    // Expires after 1 year
    this.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Model factory for multi-database support
export const createAuditLogModel = (connection: Connection) => {
  return connection.model<IAuditLogDocument>('AuditLog', auditLogSchema);
};

export default mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);
