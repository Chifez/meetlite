import mongoose from 'mongoose';

const meetingSummarySchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true,
  },
  summary: {
    type: String,
    required: true,
  },
  actionItems: [
    {
      type: String,
    },
  ],
  keyPoints: [
    {
      type: String,
    },
  ],
  participants: [
    {
      type: String,
    },
  ],
  duration: {
    type: Number,
    required: true,
  },
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'neutral',
  },
  transcription: [
    {
      speaker: String,
      text: String,
      timestamp: Number,
      confidence: Number,
    },
  ],
  insights: {
    engagement: Number,
    participation: mongoose.Schema.Types.Mixed,
    topics: [String],
    recommendations: [String],
  },
  createdBy: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

meetingSummarySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('MeetingSummary', meetingSummarySchema);
