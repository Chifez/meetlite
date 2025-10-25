import mongoose from 'mongoose';

const { Schema } = mongoose;

const pushSubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },
    deviceInfo: {
      userAgent: String,
      platform: String,
      browser: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
pushSubscriptionSchema.index({ userId: 1, isActive: 1 });
pushSubscriptionSchema.index({ endpoint: 1 });

// Update lastUsed when subscription is used
pushSubscriptionSchema.methods.updateLastUsed = function () {
  this.lastUsed = new Date();
  return this.save();
};

// Mark subscription as inactive
pushSubscriptionSchema.methods.deactivate = function () {
  this.isActive = false;
  return this.save();
};

// Factory function to create model with specific connection
export const createPushSubscriptionModel = (connection) => {
  return connection.model('PushSubscription', pushSubscriptionSchema);
};

// Default export for backward compatibility
const PushSubscription = mongoose.model(
  'PushSubscription',
  pushSubscriptionSchema
);

export default PushSubscription;
