import mongoose, { Schema, Document, Model, Connection } from 'mongoose';

export interface ITeamInvitation {
  teamId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  invitedUserId?: mongoose.Types.ObjectId;
  email?: string;
  invitedBy: mongoose.Types.ObjectId;
  role: 'member' | 'owner';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  inviteToken: string;
  message?: string;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: mongoose.Types.ObjectId;
}

export interface ITeamInvitationMethods {
  isExpired: () => boolean;
  canBeAccepted: () => boolean;
  accept: (userId: mongoose.Types.ObjectId | string) => Promise<ITeamInvitationDocument>;
  decline: () => Promise<ITeamInvitationDocument>;
}

export interface ITeamInvitationStatics extends Model<ITeamInvitationDocument, {}, ITeamInvitationMethods> {
  findPendingInvitation: (teamId: any, userId: any) => Promise<ITeamInvitationDocument | null>;
  findPendingInvitationByEmail: (teamId: any, email: string) => Promise<ITeamInvitationDocument | null>;
  findByToken: (token: string) => Promise<ITeamInvitationDocument | null>;
  findPendingInvitationsByEmail: (email: string) => Promise<ITeamInvitationDocument[]>;
  findPendingInvitationsByUser: (userId: any) => Promise<ITeamInvitationDocument[]>;
  findPendingInvitationsByTeam: (teamId: any) => Promise<ITeamInvitationDocument[]>;
}

export interface ITeamInvitationDocument extends ITeamInvitation, Document, ITeamInvitationMethods {}

export const teamInvitationSchema = new Schema<ITeamInvitationDocument, ITeamInvitationStatics, ITeamInvitationMethods>(
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

// Compound indexes
teamInvitationSchema.index({ teamId: 1, status: 1 });
teamInvitationSchema.index({ organizationId: 1, status: 1 });
teamInvitationSchema.index({ invitedUserId: 1, status: 1 });
teamInvitationSchema.index({ inviteToken: 1, status: 1 });
teamInvitationSchema.index({ expiresAt: 1, status: 1 });

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
teamInvitationSchema.methods.isExpired = function (this: ITeamInvitationDocument) {
  return this.status === 'pending' && new Date() > this.expiresAt;
};

teamInvitationSchema.methods.canBeAccepted = function (this: ITeamInvitationDocument) {
  return this.status === 'pending' && !this.isExpired();
};

teamInvitationSchema.methods.accept = function (this: ITeamInvitationDocument, userId: any) {
  if (!this.canBeAccepted()) {
    throw new Error('Invitation cannot be accepted');
  }

  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  return this.save();
};

teamInvitationSchema.methods.decline = function (this: ITeamInvitationDocument) {
  if (this.status !== 'pending') {
    throw new Error('Only pending invitations can be declined');
  }

  this.status = 'declined';
  return this.save();
};

// Static methods
teamInvitationSchema.statics.findPendingInvitation = function (teamId: any, userId: any) {
  return this.findOne({
    teamId,
    invitedUserId: userId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
};

teamInvitationSchema.statics.findPendingInvitationByEmail = function (
  teamId: any,
  email: string
) {
  return this.findOne({
    teamId,
    email: email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
};

teamInvitationSchema.statics.findByToken = function (token: string) {
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

teamInvitationSchema.statics.findPendingInvitationsByEmail = function (email: string) {
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

teamInvitationSchema.statics.findPendingInvitationsByUser = function (userId: any) {
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

teamInvitationSchema.statics.findPendingInvitationsByTeam = function (teamId: any) {
  return this.find({
    teamId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('invitedUserId', 'name email')
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });
};

// Pre-save middleware
teamInvitationSchema.pre('save', function (this: ITeamInvitationDocument, next: any) {
  if (this.status === 'pending' && this.isExpired()) {
    this.status = 'expired';
  }

  if (!this.invitedUserId && !this.email) {
    return next(new Error('Either invitedUserId or email must be provided'));
  }

  if (this.invitedUserId && this.email) {
    return next(new Error('Cannot provide both invitedUserId and email'));
  }

  next();
});

// Export the schema and factory
export const createTeamInvitationModel = (connection: Connection) => {
  return connection.model<ITeamInvitationDocument, ITeamInvitationStatics>('TeamInvitation', teamInvitationSchema);
};

export default mongoose.model<ITeamInvitationDocument, ITeamInvitationStatics>('TeamInvitation', teamInvitationSchema);
