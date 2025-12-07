import mongoose from 'mongoose';

const teamInvitationSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // Invited user - can be either userId (for existing members) or email (for new invites)
    invitedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      required: false,
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['member', 'owner'],
      default: 'member',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired'],
      default: 'pending',
      index: true,
    },
    inviteToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    message: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      default: function () {
        // Invitations expire in 7 days
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      },
    },
    acceptedAt: {
      type: Date,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
teamInvitationSchema.index({ teamId: 1, status: 1 });
teamInvitationSchema.index({ organizationId: 1, status: 1 });
teamInvitationSchema.index({ invitedUserId: 1, status: 1 });
teamInvitationSchema.index({ inviteToken: 1, status: 1 });
teamInvitationSchema.index({ expiresAt: 1, status: 1 }); // For cleanup

// Prevent duplicate pending invitations for same user/email to same team
teamInvitationSchema.index(
  { teamId: 1, invitedUserId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'pending',
      invitedUserId: { $exists: true },
    },
    sparse: true,
  }
);
teamInvitationSchema.index(
  { teamId: 1, email: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending', email: { $exists: true } },
    sparse: true,
  }
);

// Instance methods
teamInvitationSchema.methods.isExpired = function () {
  return this.status === 'pending' && new Date() > this.expiresAt;
};

teamInvitationSchema.methods.canBeAccepted = function () {
  return this.status === 'pending' && !this.isExpired();
};

teamInvitationSchema.methods.accept = function (userId) {
  if (!this.canBeAccepted()) {
    throw new Error('Invitation cannot be accepted');
  }

  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  return this.save();
};

teamInvitationSchema.methods.decline = function () {
  if (this.status !== 'pending') {
    throw new Error('Only pending invitations can be declined');
  }

  this.status = 'declined';
  return this.save();
};

// Static methods
teamInvitationSchema.statics.findPendingInvitation = function (teamId, userId) {
  return this.findOne({
    teamId,
    invitedUserId: userId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
};

teamInvitationSchema.statics.findPendingInvitationByEmail = function (
  teamId,
  email
) {
  return this.findOne({
    teamId,
    email: email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
};

teamInvitationSchema.statics.findByToken = function (token) {
  return this.findOne({
    inviteToken: token,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('teamId', 'name slug logo organizationId')
    .populate('organizationId', 'name slug logo')
    .populate('invitedUserId', 'name email')
    .populate('invitedBy', 'name email');
};

teamInvitationSchema.statics.findPendingInvitationsByEmail = function (email) {
  return this.find({
    email: email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('teamId', 'name slug logo organizationId')
    .populate('organizationId', 'name slug logo')
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });
};

teamInvitationSchema.statics.findPendingInvitationsByUser = function (userId) {
  return this.find({
    invitedUserId: userId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('teamId', 'name slug logo organizationId')
    .populate('organizationId', 'name slug logo')
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });
};

teamInvitationSchema.statics.findPendingInvitationsByTeam = function (teamId) {
  return this.find({
    teamId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('invitedUserId', 'name email')
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });
};

// Pre-save middleware to handle expiration and validation
teamInvitationSchema.pre('save', function (next) {
  if (this.status === 'pending' && this.isExpired()) {
    this.status = 'expired';
  }

  // Validate that either invitedUserId or email is provided
  if (!this.invitedUserId && !this.email) {
    return next(new Error('Either invitedUserId or email must be provided'));
  }

  if (this.invitedUserId && this.email) {
    return next(new Error('Cannot provide both invitedUserId and email'));
  }

  next();
});

// Export the schema and a factory function to create models with specific connections
export const createTeamInvitationModel = (connection) => {
  return connection.model('TeamInvitation', teamInvitationSchema);
};

// Export a default model for backward compatibility (will use default connection)
export default mongoose.model('TeamInvitation', teamInvitationSchema);
