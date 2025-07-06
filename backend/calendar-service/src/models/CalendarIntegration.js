import mongoose from 'mongoose';

const calendarIntegrationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['google'],
    required: true,
  },
  connected: {
    type: Boolean,
    default: false,
  },
  email: String,
  accessToken: String,
  refreshToken: String,
  tokenExpiry: Date,
  lastSync: {
    type: Date,
    default: Date.now,
  },
  settings: {
    autoSync: {
      type: Boolean,
      default: true,
    },
    syncInterval: {
      type: Number,
      default: 15, // minutes
    },
    importMeetings: {
      type: Boolean,
      default: true,
    },
    exportMeetings: {
      type: Boolean,
      default: true,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

calendarIntegrationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Compound index for user and calendar type
calendarIntegrationSchema.index({ userId: 1, type: 1 }, { unique: true });

export default mongoose.model('CalendarIntegration', calendarIntegrationSchema);
