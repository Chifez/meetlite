import mongoose, { Schema, Document, Connection } from 'mongoose';

export type NotificationType =
  | 'meeting_reminder'
  | 'meeting_invitation'
  | 'meeting_cancelled'
  | 'meeting_updated'
  | 'meeting_started'
  | 'participant_joined'
  | 'participant_left'
  | 'recording_ready'
  | 'transcript_ready'
  | 'system_announcement';

export type NotificationStatus = 'pending' | 'scheduled' | 'sent' | 'failed' | 'cancelled';
export type DeliveryChannel = 'in_app' | 'email' | 'push';

export interface INotification {
  userId: mongoose.Types.ObjectId;
  meetingId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  status: NotificationStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  channels: DeliveryChannel[];
  sentChannels: DeliveryChannel[];
  jobId?: string;
  read: boolean;
  readAt?: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationDocument extends INotification, Document {}

export const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    meetingId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'meeting_reminder',
        'meeting_invitation',
        'meeting_cancelled',
        'meeting_updated',
        'meeting_started',
        'participant_joined',
        'participant_left',
        'recording_ready',
        'transcript_ready',
        'system_announcement',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'sent', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    scheduledAt: {
      type: Date,
      index: true,
    },
    sentAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
      maxlength: 500,
    },
    channels: {
      type: [String],
      enum: ['in_app', 'email', 'push'],
      default: ['in_app'],
    },
    sentChannels: {
      type: [String],
      enum: ['in_app', 'email', 'push'],
      default: [],
    },
    jobId: {
      type: String,
      index: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ meetingId: 1, type: 1 });
notificationSchema.index({ status: 1, scheduledAt: 1 });
notificationSchema.index({ jobId: 1 }, { sparse: true });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware
notificationSchema.pre('save', function (this: INotificationDocument, next: any) {
  if (this.isNew && !this.expiresAt) {
    // Expires after 90 days
    this.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Model factory for multi-database support
export const createNotificationModel = (connection: Connection) => {
  return connection.model<INotificationDocument>('Notification', notificationSchema);
};

export default mongoose.model<INotificationDocument>('Notification', notificationSchema);
