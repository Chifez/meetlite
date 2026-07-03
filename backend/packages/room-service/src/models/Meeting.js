import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  scheduledTime: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number, // in minutes
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  // Organization scope for multi-tenancy
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true,
    default: null, // null means personal workspace
  },
  // Team scope - optional, only present when meeting belongs to a team
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    index: true,
    default: null, // null means organization-level meeting
  },
  participants: [
    {
      type: String, // userId
    },
  ],
  privacy: {
    type: String,
    enum: ['public', 'private'],
    default: 'public',
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  roomId: {
    type: String,
    default: null,
  },
  invites: [
    {
      email: { type: String, required: true },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending',
      },
      inviteToken: { type: String, required: true },
    },
  ],
});

// Indexes for better performance
meetingSchema.index({ organizationId: 1, createdBy: 1 });
meetingSchema.index({ organizationId: 1, scheduledTime: 1 });
meetingSchema.index({ organizationId: 1, teamId: 1 });
meetingSchema.index({ teamId: 1, scheduledTime: 1 });

// Export the schema for use with the model factory
export { meetingSchema };
