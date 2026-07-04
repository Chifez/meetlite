import mongoose, { Schema, Document, Model, Connection } from 'mongoose';

export interface IOrganizationInvitation {
  organizationId: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  email: string;
  role: 'member' | 'owner';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  inviteToken: string;
  message?: string;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: mongoose.Types.ObjectId;
}

export interface IOrganizationInvitationMethods {
  isExpired: () => boolean;
  canBeAccepted: () => boolean;
  accept: (userId: mongoose.Types.ObjectId | string) => Promise<IOrganizationInvitationDocument>;
  decline: () => Promise<IOrganizationInvitationDocument>;
}

export interface IOrganizationInvitationStatics extends Model<IOrganizationInvitationDocument, {}, IOrganizationInvitationMethods> {
  findPendingInvitation: (organizationId: any, email: string) => Promise<IOrganizationInvitationDocument | null>;
  findByToken: (token: string) => Promise<IOrganizationInvitationDocument | null>;
}

export interface IOrganizationInvitationDocument extends IOrganizationInvitation, Document, IOrganizationInvitationMethods {}

export const organizationInvitationSchema = new Schema<IOrganizationInvitationDocument, IOrganizationInvitationStatics, IOrganizationInvitationMethods>(
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

// Compound indexes
organizationInvitationSchema.index({ organizationId: 1, status: 1 });
organizationInvitationSchema.index({ email: 1, status: 1 });
organizationInvitationSchema.index({ inviteToken: 1, status: 1 });
organizationInvitationSchema.index({ expiresAt: 1, status: 1 });

// Prevent duplicate pending invitations for same email to same organization
organizationInvitationSchema.index(
  { organizationId: 1, email: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);

// Instance methods
organizationInvitationSchema.methods.isExpired = function (this: IOrganizationInvitationDocument) {
  return this.status === 'pending' && new Date() > this.expiresAt;
};

organizationInvitationSchema.methods.canBeAccepted = function (this: IOrganizationInvitationDocument) {
  return this.status === 'pending' && !this.isExpired();
};

organizationInvitationSchema.methods.accept = function (this: IOrganizationInvitationDocument, userId: any) {
  if (!this.canBeAccepted()) {
    throw new Error('Invitation cannot be accepted');
  }

  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  return this.save();
};

organizationInvitationSchema.methods.decline = function (this: IOrganizationInvitationDocument) {
  if (this.status !== 'pending') {
    throw new Error('Only pending invitations can be declined');
  }

  this.status = 'declined';
  return this.save();
};

// Static methods
organizationInvitationSchema.statics.findPendingInvitation = function (
  organizationId: any,
  email: string
) {
  return this.findOne({
    organizationId,
    email: email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
};

organizationInvitationSchema.statics.findByToken = function (token: string) {
  return this.findOne({
    inviteToken: token,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('organizationId', 'name slug logo')
    .populate('invitedBy', 'name email');
};

// Pre-save middleware
organizationInvitationSchema.pre('save', function (this: IOrganizationInvitationDocument, next: any) {
  if (this.status === 'pending' && this.isExpired()) {
    this.status = 'expired';
  }
  next();
});

// Export the schema and factory
export const createOrganizationInvitationModel = (connection: Connection) => {
  return connection.model<IOrganizationInvitationDocument, IOrganizationInvitationStatics>(
    'OrganizationInvitation',
    organizationInvitationSchema
  );
};

export default mongoose.model<IOrganizationInvitationDocument, IOrganizationInvitationStatics>(
  'OrganizationInvitation',
  organizationInvitationSchema
);
