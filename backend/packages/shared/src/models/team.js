import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
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
      required: false, // Will be set by pre-save middleware
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
    // Team owner/lead
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Team members - stored as references in User model's teamMemberships
    // This is kept for quick access, but source of truth is User.teamMemberships
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
    // Team-specific settings
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
    // Track team stats
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
    // Status
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

// Indexes for efficient queries
teamSchema.index({ organizationId: 1, status: 1 });
teamSchema.index({ ownerId: 1, status: 1 });
// Unique slug per organization, only for non-deleted teams
teamSchema.index(
  { organizationId: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: 'deleted' } },
  }
);

// Virtual for getting member count (from members array)
teamSchema.virtual('memberCount').get(function () {
  return this.members.filter((m) => m.status === 'active').length;
});

// Methods
teamSchema.methods.isMember = function (userId) {
  return this.members.some(
    (m) => m.userId.toString() === userId.toString() && m.status === 'active'
  );
};

teamSchema.methods.isOwner = function (userId) {
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

teamSchema.methods.isAdmin = function (userId) {
  return this.members.some(
    (m) =>
      m.userId.toString() === userId.toString() &&
      m.role === 'admin' &&
      m.status === 'active'
  );
};

teamSchema.methods.isOwnerOrAdmin = function (userId) {
  return this.isOwner(userId) || this.isAdmin(userId);
};

teamSchema.methods.canAddMember = function () {
  // Could add team-specific member limits here if needed
  return true;
};

// Static methods
teamSchema.statics.generateSlug = function (name) {
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

// Pre-save middleware to generate unique slug for new teams within organization
teamSchema.pre('save', async function (next) {
  // Only generate slug for new documents without one
  if (this.isNew && (!this.slug || this.slug.trim() === '')) {
    let baseSlug = this.constructor.generateSlug(this.name);
    let finalSlug = baseSlug;
    let counter = 1;

    // Ensure slug is unique within the organization, only for active teams
    while (true) {
      const existingTeam = await this.constructor.findOne({
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

  // Validate slug is present
  if (!this.slug || this.slug.trim() === '') {
    return next(new Error('Slug is required and must be generated'));
  }

  // Update stats.totalMembers from members array
  if (this.members && Array.isArray(this.members)) {
    this.stats.totalMembers = this.members.filter(
      (m) => m.status === 'active'
    ).length;
  }

  next();
});

// Export the schema and a factory function to create models with specific connections
export const createTeamModel = (connection) => {
  return connection.model('Team', teamSchema);
};

// Export a default model for backward compatibility (will use default connection)
export default mongoose.model('Team', teamSchema);
