import mongoose, { Schema, Document, Model, Connection } from 'mongoose';

export interface IOrganizationPlan {
  type: 'free' | 'pro' | 'enterprise';
  startDate: Date;
  endDate: Date | null;
  status: 'active' | 'expired' | 'cancelled';
}

export interface IOrganizationSettings {
  allowPublicMeetings: boolean;
  requireMeetingApproval: boolean;
  maxMeetingDuration: number;
  allowExternalParticipants: boolean;
  defaultMeetingPrivacy: 'public' | 'private';
}

export interface IOrganizationBilling {
  customerId?: string;
  subscriptionId?: string;
  subscriptionStatus?: 'active' | 'cancelled' | 'past_due' | 'incomplete' | 'trialing';
  currentPeriodEnd?: Date;
}

export interface IOrganizationLimits {
  maxMembers: number;
  maxMeetingsPerMonth: number;
  maxStorageGB: number;
}

export interface IOrganizationStats {
  totalMembers: number;
  totalMeetings: number;
  totalMeetingHours: number;
}

export interface IOrganization {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  industry?: string;
  size?: '1-5' | '6-20' | '21-50' | '51-200' | '201-500' | '500+';
  plan: IOrganizationPlan;
  settings: IOrganizationSettings;
  billing: IOrganizationBilling;
  limits: IOrganizationLimits;
  stats: IOrganizationStats;
  ownerId: mongoose.Types.ObjectId;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrganizationMethods {
  canAddMember: () => boolean;
  canCreateMeeting: () => boolean;
}

export interface IOrganizationStatics extends Model<IOrganizationDocument, {}, IOrganizationMethods> {
  generateSlug: (name: string) => string;
}

export interface IOrganizationDocument extends IOrganization, Document, IOrganizationMethods {}

export const organizationSchema = new Schema<IOrganizationDocument, IOrganizationStatics, IOrganizationMethods>(
  {
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
    industry: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    size: {
      type: String,
      enum: ['1-5', '6-20', '21-50', '51-200', '201-500', '500+'],
    },
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
        enum: ['active', 'expired', 'cancelled'],
        default: 'active',
      },
    },
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
    billing: {
      customerId: {
        type: String,
      },
      subscriptionId: {
        type: String,
      },
      subscriptionStatus: {
        type: String,
        enum: ['active', 'cancelled', 'past_due', 'incomplete', 'trialing'],
      },
      currentPeriodEnd: {
        type: Date,
      },
    },
    limits: {
      maxMembers: {
        type: Number,
        default: function (this: IOrganizationDocument) {
          switch (this.plan.type) {
            case 'free':
              return 10;
            case 'pro':
              return 100;
            case 'enterprise':
              return -1;
            default:
              return 10;
          }
        },
      },
      maxMeetingsPerMonth: {
        type: Number,
        default: function (this: IOrganizationDocument) {
          switch (this.plan.type) {
            case 'free':
              return 100;
            case 'pro':
              return 1000;
            case 'enterprise':
              return -1;
            default:
              return 100;
          }
        },
      },
      maxStorageGB: {
        type: Number,
        default: function (this: IOrganizationDocument) {
          switch (this.plan.type) {
            case 'free':
              return 1;
            case 'pro':
              return 100;
            case 'enterprise':
              return -1;
            default:
              return 1;
          }
        },
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
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
organizationSchema.index({ ownerId: 1, status: 1 });
organizationSchema.index(
  { ownerId: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: 'deleted' } },
  }
);
organizationSchema.index({ plan: 1, status: 1 });

// Virtual for getting member count
organizationSchema.virtual('memberCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'organizationId',
  count: true,
});

// Methods
organizationSchema.methods.canAddMember = function (this: IOrganizationDocument) {
  if (this.limits.maxMembers === -1) return true;
  return this.stats.totalMembers < this.limits.maxMembers;
};

organizationSchema.methods.canCreateMeeting = function (this: IOrganizationDocument) {
  if (this.limits.maxMeetingsPerMonth === -1) return true;
  return true;
};

// Static methods
organizationSchema.statics.generateSlug = function (name: string): string {
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

// Pre-save middleware to generate unique slug for new organizations
organizationSchema.pre('save', async function (this: any, next: any) {
  if (this.isNew && (!this.slug || this.slug.trim() === '')) {
    const baseSlug = (this.constructor as any).generateSlug(this.name);
    let finalSlug = baseSlug;
    let counter = 1;

    while (true) {
      const existingOrg = await (this.constructor as any).findOne({
        slug: finalSlug,
        status: 'active',
        _id: { $ne: this._id },
      });

      if (!existingOrg) break;

      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = finalSlug;
  }

  if (!this.slug || this.slug.trim() === '') {
    return next(new Error('Slug is required and must be generated'));
  }

  next();
});

// Export the schema and a factory function to create models with specific connections
export const createOrganizationModel = (connection: Connection) => {
  return connection.model<IOrganizationDocument, IOrganizationStatics>('Organization', organizationSchema);
};

// Export a default model for backward compatibility (will use default connection)
export default mongoose.model<IOrganizationDocument, IOrganizationStatics>('Organization', organizationSchema);
