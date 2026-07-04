import mongoose, { Schema, Document, Model, Connection } from 'mongoose';

export interface ITeamMember {
  userId: mongoose.Types.ObjectId;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  status: 'active' | 'inactive';
}

export interface ITeamSettings {
  allowPublicMeetings: boolean;
  requireMeetingApproval: boolean;
  maxMeetingDuration: number;
  allowExternalParticipants: boolean;
  defaultMeetingPrivacy: 'public' | 'private';
}

export interface ITeamStats {
  totalMembers: number;
  totalMeetings: number;
  totalMeetingHours: number;
}

export interface ITeam {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  ownerId: mongoose.Types.ObjectId;
  members: ITeamMember[];
  settings: ITeamSettings;
  stats: ITeamStats;
  status: 'active' | 'archived' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeamMethods {
  isMember: (userId: mongoose.Types.ObjectId | string) => boolean;
  isOwner: (userId: mongoose.Types.ObjectId | string) => boolean;
  isAdmin: (userId: mongoose.Types.ObjectId | string) => boolean;
  isOwnerOrAdmin: (userId: mongoose.Types.ObjectId | string) => boolean;
  canAddMember: () => boolean;
}

export interface ITeamStatics extends Model<ITeamDocument, {}, ITeamMethods> {
  generateSlug: (name: string) => string;
}

export interface ITeamDocument extends ITeam, Document, ITeamMethods {
  memberCount: number;
}

export const teamSchema = new Schema<ITeamDocument, ITeamStatics, ITeamMethods>(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    logo: {
      type: String,
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
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
      },
    ],
    settings: {
      allowPublicMeetings: {
        type: Boolean,
        default: true,
      },
      requireMeetingApproval: {
        type: Boolean,
        default: false,
      },
      maxMeetingDuration: {
        type: Number,
        default: 480,
      },
      allowExternalParticipants: {
        type: Boolean,
        default: true,
      },
      defaultMeetingPrivacy: {
        type: String,
        enum: ['public', 'private'],
        default: 'public',
      },
    },
    stats: {
      totalMembers: {
        type: Number,
        default: 0,
      },
      totalMeetings: {
        type: Number,
        default: 0,
      },
      totalMeetingHours: {
        type: Number,
        default: 0,
      },
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
teamSchema.index({ organizationId: 1, status: 1 });
teamSchema.index({ ownerId: 1, status: 1 });
teamSchema.index(
  { organizationId: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: 'deleted' } },
  }
);

// Virtual for getting member count
teamSchema.virtual('memberCount').get(function (this: ITeamDocument) {
  return this.members.filter((m) => m.status === 'active').length;
});

// Methods
teamSchema.methods.isMember = function (this: ITeamDocument, userId: any) {
  return this.members.some(
    (m) => m.userId.toString() === userId.toString() && m.status === 'active'
  );
};

teamSchema.methods.isOwner = function (this: ITeamDocument, userId: any) {
  return (
    this.ownerId.toString() === userId.toString() ||
    this.members.some(
      (m) =>
        m.userId.toString() === userId.toString() &&
        m.role === 'owner' &&
        m.status === 'active'
    )
  );
};

teamSchema.methods.isAdmin = function (this: ITeamDocument, userId: any) {
  return this.members.some(
    (m) =>
      m.userId.toString() === userId.toString() &&
      m.role === 'admin' &&
      m.status === 'active'
  );
};

teamSchema.methods.isOwnerOrAdmin = function (this: ITeamDocument, userId: any) {
  return this.isOwner(userId) || this.isAdmin(userId);
};

teamSchema.methods.canAddMember = function (this: ITeamDocument) {
  return true;
};

// Static methods
teamSchema.statics.generateSlug = function (name: string): string {
  if (!name || typeof name !== 'string') {
    return 'default-slug';
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  return slug;
};

// Pre-save middleware
teamSchema.pre('save', async function (this: any, next: any) {
  if (this.isNew && (!this.slug || this.slug.trim() === '')) {
    const baseSlug = (this.constructor as any).generateSlug(this.name);
    let finalSlug = baseSlug;
    let counter = 1;

    while (true) {
      const existingTeam = await (this.constructor as any).findOne({
        organizationId: this.organizationId,
        slug: finalSlug,
        status: { $ne: 'deleted' },
        _id: { $ne: this._id },
      });

      if (!existingTeam) break;

      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = finalSlug;
  }

  if (!this.slug || this.slug.trim() === '') {
    return next(new Error('Slug is required and must be generated'));
  }

  if (this.members && Array.isArray(this.members)) {
    this.stats.totalMembers = this.members.filter(
      (m: any) => m.status === 'active'
    ).length;
  }

  next();
});

// Export the schema and factory
export const createTeamModel = (connection: Connection) => {
  return connection.model<ITeamDocument, ITeamStatics>('Team', teamSchema);
};

export default mongoose.model<ITeamDocument, ITeamStatics>('Team', teamSchema);
