import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  scheduledTime: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number, // in minutes
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  // Organization scope for multi-tenancy
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true,
    default: null, // null means personal workspace
  },
  // Team scope - optional, only present when meeting belongs to a team
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    index: true,
    default: null, // null means organization-level meeting
  },
  participants: [
    {
      type: String, // userId
    },
  ],
  privacy: {
    type: String,
    enum: ['public', 'private'],
    default: 'public',
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  roomId: {
    type: String,
    default: null,
  },
  invites: [
    {
      email: { type: String, required: true },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending',
      },
      inviteToken: { type: String, required: true },
    },
  ],
  // Recurrence fields
  isRecurring: {
    type: Boolean,
    default: false,
    index: true,
  },
  recurrence: {
    pattern: {
      type: String,
      enum: ['daily', 'weekdays', 'weekly', 'monthly', 'yearly', 'custom'],
    },
    interval: {
      type: Number,
      default: 1, // Every N days/weeks/months
      min: 1,
    },
    daysOfWeek: [
      {
        type: Number, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        min: 0,
        max: 6,
      },
    ],
    dayOfMonth: {
      type: Number, // For monthly recurrence (e.g., 15th of each month)
      min: 1,
      max: 31,
    },
    endDate: {
      type: Date, // Recurrence ends on this date
    },
    occurrences: {
      type: Number, // Number of occurrences (alternative to endDate)
      min: 1,
    },
    endType: {
      type: String,
      enum: ['never', 'after', 'on'],
      default: 'never',
    },
    rrule: {
      type: String, // RFC 5545 RRULE string (for complex patterns)
    },
  },
  recurrenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    default: null, // Points to parent meeting for recurring series
    index: true,
  },
  recurrenceExceptions: [
    {
      date: {
        type: Date,
        required: true,
      }, // Date of exception (cancelled/modified instance)
      action: {
        type: String,
        enum: ['cancelled', 'modified'],
        required: true,
      },
      modifiedMeetingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meeting', // If modified, link to the modified instance
      },
    },
  ],
});

// Indexes for better performance
meetingSchema.index({ organizationId: 1, createdBy: 1 });
meetingSchema.index({ organizationId: 1, scheduledTime: 1 });
meetingSchema.index({ organizationId: 1, teamId: 1 });
meetingSchema.index({ teamId: 1, scheduledTime: 1 });
meetingSchema.index({ isRecurring: 1, scheduledTime: 1 });
meetingSchema.index({ recurrenceId: 1 });

// Export the schema and a factory function to create models with specific connections
export const createMeetingModel = (connection) => {
  return connection.model('Meeting', meetingSchema);
};

// Export a default model for backward compatibility (will use default connection)
export default mongoose.model('Meeting', meetingSchema);


