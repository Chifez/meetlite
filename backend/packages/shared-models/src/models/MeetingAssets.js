import mongoose from 'mongoose';

// Meeting Recording schema
const meetingRecordingSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: false, // Allow standalone recordings without a meeting
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Recording file details
    recording: {
      fileName: String,
      fileSize: Number, // in bytes
      duration: Number, // in seconds
      format: String, // mp4, webm, etc.
      quality: String, // 720p, 1080p, etc.
      storageProvider: {
        type: String,
        enum: ['local', 's3', 'gcs', 'azure', 'r2'],
        default: 'r2',
      },
      storagePath: String,
      downloadUrl: String,
      streamingUrl: String,
      thumbnailUrl: String,
    },
    // Transcript details
    transcript: {
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
      },
      text: String, // Full transcript text
      segments: [
        {
          startTime: Number, // seconds
          endTime: Number, // seconds
          speaker: String,
          text: String,
          confidence: Number, // 0-1
        },
      ],
      language: {
        type: String,
        default: 'en',
      },
      processingProvider: {
        type: String,
        enum: ['openai', 'google', 'azure', 'aws'],
      },
      fileName: String, // PDF/TXT file name
      fileUrl: String, // Download URL for transcript file
    },
    // AI Summary details
    aiSummary: {
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
      },
      summary: String,
      keyPoints: [String],
      actionItems: [
        {
          task: String,
          assignee: String,
          dueDate: Date,
          priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
          },
        },
      ],
      topics: [String],
      sentiment: {
        overall: String, // positive, neutral, negative
        score: Number, // -1 to 1
      },
      processingProvider: {
        type: String,
        enum: ['openai', 'claude', 'gemini'],
      },
    },
    // Access control
    visibility: {
      type: String,
      enum: ['organization', 'participants', 'private'],
      default: 'participants',
    },
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          enum: ['host', 'participant', 'viewer'],
        },
        joinTime: Date,
        leaveTime: Date,
        speakingTime: Number, // in seconds
      },
    ],
    // Processing status
    processingStatus: {
      type: String,
      enum: ['uploading', 'processing', 'completed', 'failed'],
      default: 'uploading',
    },
    processingProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    // Metadata
    tags: [String],
    isArchived: {
      type: Boolean,
      default: false,
    },
    archiveDate: Date,
    retentionPolicy: {
      deleteAfterDays: Number, // Auto-delete after X days
      lastAccessDate: Date,
    },
    analytics: {
      viewCount: {
        type: Number,
        default: 0,
      },
      downloadCount: {
        type: Number,
        default: 0,
      },
      lastViewed: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
meetingRecordingSchema.index({ organizationId: 1, createdAt: -1 });
meetingRecordingSchema.index({ meetingId: 1 });
meetingRecordingSchema.index({ 'participants.userId': 1 });
meetingRecordingSchema.index({ tags: 1 });
meetingRecordingSchema.index({ processingStatus: 1 });
meetingRecordingSchema.index({ 'transcript.status': 1 });
meetingRecordingSchema.index({ 'aiSummary.status': 1 });

// Virtual fields
meetingRecordingSchema.virtual('isProcessing').get(function () {
  return ['uploading', 'processing'].includes(this.processingStatus);
});

meetingRecordingSchema.virtual('hasTranscript').get(function () {
  return this.transcript?.status === 'completed';
});

meetingRecordingSchema.virtual('hasSummary').get(function () {
  return this.aiSummary?.status === 'completed';
});

// Instance methods
meetingRecordingSchema.methods.canAccess = function (userId, userRole) {
  // Organization owners can access all recordings
  if (userRole === 'owner') return true;

  // Check visibility settings
  if (this.visibility === 'organization') return true;
  if (this.visibility === 'private')
    return this.participants.some(
      (p) => p.userId.toString() === userId.toString()
    );
  if (this.visibility === 'participants') {
    return this.participants.some(
      (p) => p.userId.toString() === userId.toString()
    );
  }

  return false;
};

meetingRecordingSchema.methods.incrementViewCount = async function () {
  this.analytics.viewCount += 1;
  this.analytics.lastViewed = new Date();
  this.retentionPolicy.lastAccessDate = new Date();
  return this.save();
};

meetingRecordingSchema.methods.incrementDownloadCount = async function () {
  this.analytics.downloadCount += 1;
  return this.save();
};

// Static methods
meetingRecordingSchema.statics.findByOrganization = function (
  organizationId,
  options = {}
) {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    status,
    tags,
    search,
    isArchived,
  } = options;

  const query = { organizationId };

  // Handle archive status - if not specified, default to non-archived
  if (isArchived !== undefined) {
    query.isArchived = isArchived;
  } else {
    query.isArchived = false; // Default to non-archived
  }

  if (status) query.processingStatus = status;
  if (tags && tags.length > 0) query.tags = { $in: tags };
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
    ];
  }

  return this.find(query)
    .populate('meetingId', 'title scheduledTime')
    .populate('participants.userId', 'name email')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
    .then((recordings) => {
      // Transform participants to flatten the populated user data
      return recordings.map((recording) => {
        if (recording.participants) {
          recording.participants = recording.participants.map((participant) => {
            if (participant.userId && typeof participant.userId === 'object') {
              return {
                ...participant,
                name: participant.userId.name || '',
                email: participant.userId.email || '',
                userId: participant.userId._id,
              };
            }
            return participant;
          });
        }
        return recording;
      });
    });
};

meetingRecordingSchema.statics.getStorageStats = function (organizationId) {
  return this.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isArchived: { $ne: true }, // Exclude archived recordings
      },
    },
    {
      $group: {
        _id: null,
        totalRecordings: { $sum: 1 },
        totalSize: { $sum: '$recording.fileSize' },
        totalDuration: { $sum: '$recording.duration' },
        completedTranscripts: {
          $sum: { $cond: [{ $eq: ['$transcript.status', 'completed'] }, 1, 0] },
        },
        completedSummaries: {
          $sum: { $cond: [{ $eq: ['$aiSummary.status', 'completed'] }, 1, 0] },
        },
      },
    },
  ]);
};

// Export model factory
export const createMeetingRecordingModel = (connection) => {
  return connection.model('MeetingRecording', meetingRecordingSchema);
};

export default mongoose.model('MeetingRecording', meetingRecordingSchema);
