import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
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
  // Onboarding status and collected onboarding preferences
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
  // Multitenancy fields - support multiple organization memberships
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true,
    // This is the currently active organization for backward compatibility
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'owner',
    // This is the role in the currently active organization
  },
  // Multiple organization memberships
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
  // Multiple team memberships within organizations
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
  // Plan information and usage tracking
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
  // Stripe customer ID
  stripeCustomerId: {
    type: String,
    index: true,
  },
  // Usage tracking for plan constraints
  usage: {
    // Organization usage
    organizationsOwned: {
      type: Number,
      default: 0,
    },
    organizationsMember: {
      type: Number,
      default: 0,
    },
    // Invitation usage
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
    // Meeting usage
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
    // Storage usage
    storageUsedGB: {
      type: Number,
      default: 0,
    },
    // API usage
    apiCallsToday: {
      type: Number,
      default: 0,
    },
    lastApiCallDate: {
      type: Date,
      default: null,
    },
  },
  // Token versioning for JWT invalidation
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

// Export the schema and a factory function to create models with specific connections
export const createUserModel = (connection) => {
  return connection.model('User', userSchema);
};

// Export a default model for backward compatibility (will use default connection)
export default mongoose.model('User', userSchema);
