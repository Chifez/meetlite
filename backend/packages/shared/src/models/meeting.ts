import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface IMeetingInvite {
  email: string;
  status: 'pending' | 'accepted' | 'declined';
  inviteToken: string;
}

export interface IMeetingRecurrence {
  pattern?: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: Date;
  occurrences?: number;
  endType?: 'never' | 'after' | 'on';
  rrule?: string;
}

export interface IMeetingRecurrenceException {
  date: Date;
  action: 'cancelled' | 'modified';
  modifiedMeetingId?: mongoose.Types.ObjectId;
}

export interface IMeeting {
  meetingId: string;
  title: string;
  description?: string;
  scheduledTime: Date;
  duration: number;
  createdBy: string;
  organizationId?: mongoose.Types.ObjectId | null;
  teamId?: mongoose.Types.ObjectId | null;
  participants: string[];
  privacy: 'public' | 'private';
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: Date;
  roomId?: string | null;
  invites: IMeetingInvite[];
  isRecurring: boolean;
  recurrence?: IMeetingRecurrence;
  recurrenceId?: mongoose.Types.ObjectId | null;
  recurrenceExceptions?: IMeetingRecurrenceException[];
}

export interface IMeetingDocument extends IMeeting, Document {}

export const meetingSchema = new Schema<IMeetingDocument>({
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
    type: Number,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true,
    default: null,
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    index: true,
    default: null,
  },
  participants: [
    {
      type: String,
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
      default: 1,
      min: 1,
    },
    daysOfWeek: [
      {
        type: Number,
        min: 0,
        max: 6,
      },
    ],
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
    },
    endDate: {
      type: Date,
    },
    occurrences: {
      type: Number,
      min: 1,
    },
    endType: {
      type: String,
      enum: ['never', 'after', 'on'],
      default: 'never',
    },
    rrule: {
      type: String,
    },
  },
  recurrenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    default: null,
    index: true,
  },
  recurrenceExceptions: [
    {
      date: {
        type: Date,
        required: true,
      },
      action: {
        type: String,
        enum: ['cancelled', 'modified'],
        required: true,
      },
      modifiedMeetingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meeting',
      },
    },
  ],
});

meetingSchema.index({ organizationId: 1, createdBy: 1 });
meetingSchema.index({ organizationId: 1, scheduledTime: 1 });
meetingSchema.index({ organizationId: 1, teamId: 1 });
meetingSchema.index({ teamId: 1, scheduledTime: 1 });
meetingSchema.index({ isRecurring: 1, scheduledTime: 1 });
meetingSchema.index({ recurrenceId: 1 });

export const createMeetingModel = (connection: Connection) => {
  return connection.model<IMeetingDocument>('Meeting', meetingSchema);
};

export default mongoose.model<IMeetingDocument>('Meeting', meetingSchema);
