import mongoose from 'mongoose';

const calendarIntegrationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    calendarType: {
      type: String,
      required: true,
      enum: ['google', 'outlook', 'apple'],
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    tokenExpiry: {
      type: Date,
      required: true,
    },
    isConnected: {
      type: Boolean,
      default: true,
    },
    lastSync: {
      type: Date,
      default: Date.now,
    },
    calendarId: {
      type: String,
      default: 'primary',
    },
    email: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one integration per user per calendar type
calendarIntegrationSchema.index(
  { userId: 1, calendarType: 1 },
  { unique: true }
);

// Method to check if token is expired
calendarIntegrationSchema.methods.isTokenExpired = function (this: any) {
  return new Date() > this.tokenExpiry;
};

// Method to refresh token
calendarIntegrationSchema.methods.refreshAccessToken = async function (this: any) {
  // Implementation for token refresh logic
};

export { calendarIntegrationSchema };
