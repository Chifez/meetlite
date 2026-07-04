import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface IUserOnboarding {
  name?: string;
  useCase?: 'personal' | 'education' | 'business' | 'team';
  teamSize?: '1-5' | '6-20' | '21-50' | '50+';
  primaryUse?: string[];
  experience?: 'beginner' | 'intermediate' | 'advanced';
}

export interface IUserMembership {
  organizationId: mongoose.Types.ObjectId;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  status: 'active' | 'inactive' | 'pending';
  invitedBy?: mongoose.Types.ObjectId;
}

export interface IUserTeamMembership {
  teamId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  status: 'active' | 'inactive';
  invitedBy?: mongoose.Types.ObjectId;
}

export interface IUserPlan {
  type: 'free' | 'pro' | 'enterprise';
  startDate: Date;
  endDate: Date | null;
  status: 'active' | 'expired' | 'cancelled' | 'past_due';
  stripeSubscriptionId?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  lastPaymentDate?: Date;
  lastWarningSent?: Date | null;
}

export interface IUserUsage {
  organizationsOwned: number;
  organizationsMember: number;
  invitationsSentToday: number;
  invitationsSentThisMonth: number;
  lastInvitationDate: Date | null;
  lastMonthlyReset: Date;
  meetingsCreatedToday: number;
  meetingsCreatedThisMonth: number;
  lastMeetingDate: Date | null;
  storageUsedGB: number;
  apiCallsToday: number;
  lastApiCallDate: Date | null;
}

export interface IUserNotificationPreferences {
  enabled: boolean;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  types: {
    meetingReminders: boolean;
    meetingInvitations: boolean;
    meetingUpdates: boolean;
    recordingReady: boolean;
  };
}

export interface IUser {
  email: string;
  password?: string;
  googleId?: string;
  name: string;
  useNameInMeetings: boolean;
  onboardingCompleted: boolean;
  onboarding?: IUserOnboarding;
  organizationId?: mongoose.Types.ObjectId | null;
  role: 'owner' | 'admin' | 'member';
  memberships: IUserMembership[];
  teamMemberships: IUserTeamMembership[];
  plan: IUserPlan;
  stripeCustomerId?: string;
  usage: IUserUsage;
  isSystemAdmin: boolean;
  tokenVersion: number;
  resetToken?: string | null;
  resetTokenExpiry?: Date | null;
  notificationPreferences: IUserNotificationPreferences;
  createdAt: Date;
}

export interface IUserDocument extends IUser, Document {}

export const userSchema = new Schema<IUserDocument>({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: function (this: IUserDocument) {
      return !this.googleId;
    } as any,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  useNameInMeetings: {
    type: Boolean,
    default: false,
  },
  onboardingCompleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  onboarding: {
    name: { type: String, trim: true },
    useCase: {
      type: String,
      enum: ['personal', 'education', 'business', 'team'],
    },
    teamSize: {
      type: String,
      enum: ['1-5', '6-20', '21-50', '50+'],
    },
    primaryUse: [{ type: String }],
    experience: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
    },
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true,
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'owner',
  },
  memberships: [
    {
      organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
      },
      role: {
        type: String,
        enum: ['owner', 'admin', 'member'],
        required: true,
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      status: {
        type: String,
        enum: ['active', 'inactive', 'pending'],
        default: 'active',
      },
      invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
  ],
  teamMemberships: [
    {
      teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
      },
      organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
      },
      role: {
        type: String,
        enum: ['owner', 'admin', 'member'],
        default: 'member',
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
      },
      invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
  ],
  plan: {
    type: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'past_due'],
      default: 'active',
    },
    stripeSubscriptionId: {
      type: String,
    },
    stripeSessionId: {
      type: String,
    },
    stripePaymentIntentId: {
      type: String,
    },
    lastPaymentDate: {
      type: Date,
    },
    lastWarningSent: {
      type: Date,
      default: null,
    },
  },
  stripeCustomerId: {
    type: String,
    index: true,
  },
  usage: {
    organizationsOwned: {
      type: Number,
      default: 0,
    },
    organizationsMember: {
      type: Number,
      default: 0,
    },
    invitationsSentToday: {
      type: Number,
      default: 0,
    },
    invitationsSentThisMonth: {
      type: Number,
      default: 0,
    },
    lastInvitationDate: {
      type: Date,
      default: null,
    },
    lastMonthlyReset: {
      type: Date,
      default: Date.now,
    },
    meetingsCreatedToday: {
      type: Number,
      default: 0,
    },
    meetingsCreatedThisMonth: {
      type: Number,
      default: 0,
    },
    lastMeetingDate: {
      type: Date,
      default: null,
    },
    storageUsedGB: {
      type: Number,
      default: 0,
    },
    apiCallsToday: {
      type: Number,
      default: 0,
    },
    lastApiCallDate: {
      type: Date,
      default: null,
    },
  },
  isSystemAdmin: {
    type: Boolean,
    default: false,
    index: true,
  },
  tokenVersion: {
    type: Number,
    default: 1,
  },
  resetToken: {
    type: String,
    default: null,
  },
  resetTokenExpiry: {
    type: Date,
    default: null,
  },
  notificationPreferences: {
    enabled: {
      type: Boolean,
      default: true,
    },
    channels: {
      inApp: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: false,
      },
    },
    types: {
      meetingReminders: {
        type: Boolean,
        default: true,
      },
      meetingInvitations: {
        type: Boolean,
        default: true,
      },
      meetingUpdates: {
        type: Boolean,
        default: true,
      },
      recordingReady: {
        type: Boolean,
        default: true,
      },
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ organizationId: 1 });
userSchema.index({ 'memberships.organizationId': 1 });
userSchema.index({ 'memberships.status': 1 });
userSchema.index({ 'teamMemberships.teamId': 1 });
userSchema.index({ 'teamMemberships.organizationId': 1 });
userSchema.index({ 'teamMemberships.status': 1 });
userSchema.index({ 'plan.type': 1 });
userSchema.index({ 'plan.status': 1 });
userSchema.index({ onboardingCompleted: 1 });
userSchema.index({ isSystemAdmin: 1 });

// Export the schema and a factory function to create models with specific connections
export const createUserModel = (connection: Connection) => {
  return connection.model<IUserDocument>('User', userSchema);
};

// Export a default model for backward compatibility (will use default connection)
export default mongoose.model<IUserDocument>('User', userSchema);
