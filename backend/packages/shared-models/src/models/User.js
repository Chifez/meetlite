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
  // Multitenancy fields (single-organization for now)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true,
  },
  role: {
    type: String,
    enum: ['owner', 'member'],
    default: 'owner',
  },
  // Plan information (default free until billing is implemented)
  plan: {
    type: String,
    enum: ['free', 'pro', 'business', 'enterprise'],
    default: 'free',
    index: true,
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

// Export the schema and a factory function to create models with specific connections
export const createUserModel = (connection) => {
  return connection.model('User', userSchema);
};

// Export a default model for backward compatibility (will use default connection)
export default mongoose.model('User', userSchema);
