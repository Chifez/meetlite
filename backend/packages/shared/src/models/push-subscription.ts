import mongoose, { Schema, Document, Model, Connection } from 'mongoose';

export interface IPushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface IPushSubscriptionDeviceInfo {
  userAgent?: string;
  platform?: string;
  browser?: string;
}

export interface IPushSubscription {
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: IPushSubscriptionKeys;
  deviceInfo?: IPushSubscriptionDeviceInfo;
  isActive: boolean;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPushSubscriptionMethods {
  updateLastUsed: () => Promise<IPushSubscriptionDocument>;
  deactivate: () => Promise<IPushSubscriptionDocument>;
}

export interface IPushSubscriptionDocument extends IPushSubscription, Document, IPushSubscriptionMethods {}

export const pushSubscriptionSchema = new Schema<IPushSubscriptionDocument, Model<IPushSubscriptionDocument>, IPushSubscriptionMethods>(
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

// Indexes
pushSubscriptionSchema.index({ userId: 1, isActive: 1 });
pushSubscriptionSchema.index({ endpoint: 1 });

// Instance methods
pushSubscriptionSchema.methods.updateLastUsed = function (this: IPushSubscriptionDocument) {
  this.lastUsed = new Date();
  return this.save();
};

pushSubscriptionSchema.methods.deactivate = function (this: IPushSubscriptionDocument) {
  this.isActive = false;
  return this.save();
};

// Factory function
export const createPushSubscriptionModel = (connection: Connection) => {
  return connection.model<IPushSubscriptionDocument>('PushSubscription', pushSubscriptionSchema);
};

// Default export
export default mongoose.model<IPushSubscriptionDocument>('PushSubscription', pushSubscriptionSchema);
