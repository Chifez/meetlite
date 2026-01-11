import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: false, // Will be set by pre-save middleware
      // unique: true,
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
      type: String, // URL to logo image
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
        type: Number, // in minutes
        default: 480, // 8 hours
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
        type: String, // Stripe customer ID
      },
      subscriptionId: {
        type: String, // Stripe subscription ID
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
        default: function () {
          switch (this.plan.type) {
            case 'free':
              return 10;
            case 'pro':
              return 100;
            case 'enterprise':
              return -1; // unlimited
            default:
              return 10;
          }
        },
      },
      maxMeetingsPerMonth: {
        type: Number,
        default: function () {
          switch (this.plan.type) {
            case 'free':
              return 100;
            case 'pro':
              return 1000;
            case 'enterprise':
              return -1; // unlimited
            default:
              return 100;
          }
        },
      },
      maxStorageGB: {
        type: Number,
        default: function () {
          switch (this.plan.type) {
            case 'free':
              return 1;
            case 'pro':
              return 100;
            case 'enterprise':
              return -1; // unlimited
            default:
              return 1;
          }
        },
      },
    },
    // Track organization stats
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
    // Owner information
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Status
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
// unique slug per owner, only for non-deleted organizations
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
organizationSchema.methods.canAddMember = function () {
  if (this.limits.maxMembers === -1) return true; // unlimited
  return this.stats.totalMembers < this.limits.maxMembers;
};

organizationSchema.methods.canCreateMeeting = function () {
  if (this.limits.maxMeetingsPerMonth === -1) return true; // unlimited
  // This would need to check current month's meeting count
  return true; // Simplified for now
};

// Static methods
organizationSchema.statics.generateSlug = function (name) {
  if (!name || typeof name !== 'string') {
    return 'default-slug';
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .slice(0, 50); // Limit length

  return slug;
};

// Pre-save middleware to generate unique slug for new organizations
organizationSchema.pre('save', async function (next) {
  // Only generate slug for new documents without one
  if (this.isNew && (!this.slug || this.slug.trim() === '')) {
    let baseSlug = this.constructor.generateSlug(this.name);
    let finalSlug = baseSlug;
    let counter = 1;

    // Ensure slug is unique among active organizations only
    while (true) {
      const existingOrg = await this.constructor.findOne({
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

  // Validate slug is present
  if (!this.slug || this.slug.trim() === '') {
    return next(new Error('Slug is required and must be generated'));
  }

  next();
});

// Export the schema and a factory function to create models with specific connections
export const createOrganizationModel = (connection) => {
  return connection.model('Organization', organizationSchema);
};

// Export a default model for backward compatibility (will use default connection)
export default mongoose.model('Organization', organizationSchema);
