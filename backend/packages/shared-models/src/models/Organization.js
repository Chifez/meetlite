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
      unique: true,
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
      type: String,
      enum: ['free', 'pro', 'business', 'enterprise'],
      default: 'free',
      index: true,
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
          switch (this.plan) {
            case 'free':
              return 5;
            case 'pro':
              return 25;
            case 'business':
              return 100;
            case 'enterprise':
              return 1000;
            default:
              return 5;
          }
        },
      },
      maxMeetingsPerMonth: {
        type: Number,
        default: function () {
          switch (this.plan) {
            case 'free':
              return 100;
            case 'pro':
              return 500;
            case 'business':
              return 2000;
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
          switch (this.plan) {
            case 'free':
              return 1;
            case 'pro':
              return 10;
            case 'business':
              return 100;
            case 'enterprise':
              return 1000;
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
organizationSchema.index({ slug: 1 });
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
  console.log('generateSlug called with name:', name);

  if (!name || typeof name !== 'string') {
    console.error('Invalid name provided to generateSlug:', name);
    return 'default-slug';
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .slice(0, 50); // Limit length

  console.log('Generated slug result:', slug);
  return slug;
};

// Pre-save middleware to generate slug if not provided
organizationSchema.pre('save', function (next) {
  console.log('Pre-save middleware running for Organization');
  console.log('Document is new:', this.isNew);
  console.log('Current slug:', this.slug);
  console.log('Document name:', this.name);

  // Always ensure slug is set for new documents
  if (this.isNew && (!this.slug || this.slug.trim() === '')) {
    // Generate slug synchronously to avoid async issues
    let baseSlug = this.constructor.generateSlug(this.name);
    this.slug = baseSlug;
    console.log('Generated slug:', baseSlug, 'for name:', this.name);
  }

  // Validate that slug is present before saving
  if (!this.slug || this.slug.trim() === '') {
    console.error('Slug validation failed - slug is missing or empty');
    return next(new Error('Slug is required and must be generated'));
  }

  console.log('Pre-save middleware completed successfully');
  next();
});

// Export the schema and a factory function to create models with specific connections
export const createOrganizationModel = (connection) => {
  return connection.model('Organization', organizationSchema);
};

// Export a default model for backward compatibility (will use default connection)
export default mongoose.model('Organization', organizationSchema);
