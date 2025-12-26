import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    // User who will receive the notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Related meeting (if applicable)
    meetingId: {
      type: String,
      index: true,
    },

    // Notification type
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

    // Notification content
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

    // Additional data (flexible JSON)
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Notification status
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'sent', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // Scheduling
    scheduledAt: {
      type: Date,
      index: true,
    },

    sentAt: {
      type: Date,
    },

    // Cancellation tracking
    cancelledAt: {
      type: Date,
    },

    cancelReason: {
      type: String,
      maxlength: 500,
    },

    // Delivery channels
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

    // BullMQ job ID for cancellation
    jobId: {
      type: String,
      index: true,
    },

    // Read status (for in-app notifications)
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
    },

    // Auto-cleanup
    expiresAt: {
      type: Date,
      index: true,
    },

    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ meetingId: 1, type: 1 });
notificationSchema.index({ status: 1, scheduledAt: 1 });
notificationSchema.index({ jobId: 1 }, { sparse: true });

// TTL index for auto-cleanup of old notifications (90 days)
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Set expiration date on creation if not set
notificationSchema.pre('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    // Notifications expire after 90 days
    this.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Model factory for multi-database support
export const createNotificationModel = (connection) => {
  return connection.model('Notification', notificationSchema);
};

// Default export for single database
const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;

