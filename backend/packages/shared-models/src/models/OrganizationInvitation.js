import mongoose from 'mongoose';

const organizationInvitationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
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
organizationInvitationSchema.index({ organizationId: 1, status: 1 });
organizationInvitationSchema.index({ email: 1, status: 1 });
organizationInvitationSchema.index({ inviteToken: 1, status: 1 });
organizationInvitationSchema.index({ expiresAt: 1, status: 1 }); // For cleanup

// Prevent duplicate pending invitations for same email to same organization
organizationInvitationSchema.index(
  { organizationId: 1, email: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);

// Instance methods
organizationInvitationSchema.methods.isExpired = function () {
  return this.status === 'pending' && new Date() > this.expiresAt;
};

organizationInvitationSchema.methods.canBeAccepted = function () {
  return this.status === 'pending' && !this.isExpired();
};

organizationInvitationSchema.methods.accept = function (userId) {
  if (!this.canBeAccepted()) {
    throw new Error('Invitation cannot be accepted');
  }

  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  return this.save();
};

organizationInvitationSchema.methods.decline = function () {
  if (this.status !== 'pending') {
    throw new Error('Only pending invitations can be declined');
  }

  this.status = 'declined';
  return this.save();
};

// Static methods
organizationInvitationSchema.statics.findPendingInvitation = function (
  organizationId,
  email
) {
  return this.findOne({
    organizationId,
    email: email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
};

organizationInvitationSchema.statics.findByToken = function (token) {
  return this.findOne({
    inviteToken: token,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('organizationId', 'name slug logo')
    .populate('invitedBy', 'name email');
};

// Pre-save middleware to handle expiration
organizationInvitationSchema.pre('save', function (next) {
  if (this.status === 'pending' && this.isExpired()) {
    this.status = 'expired';
  }
  next();
});

// Export the schema and a factory function to create models with specific connections
export const createOrganizationInvitationModel = (connection) => {
  return connection.model(
    'OrganizationInvitation',
    organizationInvitationSchema
  );
};

// Export a default model for backward compatibility (will use default connection)
export default mongoose.model(
  'OrganizationInvitation',
  organizationInvitationSchema
);
