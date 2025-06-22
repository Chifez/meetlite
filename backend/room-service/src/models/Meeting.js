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

export default mongoose.model('Meeting', meetingSchema);
