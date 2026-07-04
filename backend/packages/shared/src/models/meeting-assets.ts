import mongoose, { Schema, Document, Model, Connection } from 'mongoose';

export interface IMeetingRecordingFile {
  fileName?: string;
  fileSize?: number;
  duration?: number;
  format?: string;
  quality?: string;
  storageProvider: 'local' | 's3' | 'gcs' | 'azure' | 'r2';
  storagePath?: string;
  downloadUrl?: string;
  streamingUrl?: string;
  thumbnailUrl?: string;
}

export interface IMeetingRecordingTranscriptSegment {
  startTime: number;
  endTime: number;
  speaker: string;
  text: string;
  confidence: number;
}

export interface IMeetingRecordingTranscript {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  text?: string;
  segments: IMeetingRecordingTranscriptSegment[];
  language: string;
  processingProvider?: 'openai' | 'google' | 'azure' | 'aws';
  fileName?: string;
  fileUrl?: string;
}

export interface IMeetingRecordingActionItem {
  task: string;
  assignee: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface IMeetingRecordingAiSummary {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  summary?: string;
  keyPoints?: string[];
  actionItems: IMeetingRecordingActionItem[];
  topics?: string[];
  sentiment?: {
    overall?: string;
    score?: number;
  };
  processingProvider?: 'openai' | 'claude' | 'gemini';
}

export interface IMeetingRecordingParticipant {
  userId: mongoose.Types.ObjectId;
  role: 'host' | 'participant' | 'viewer';
  joinTime?: Date;
  leaveTime?: Date;
  speakingTime?: number;
}

export interface IMeetingRecording {
  meetingId?: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  teamId?: mongoose.Types.ObjectId | null;
  title: string;
  description?: string;
  recording?: IMeetingRecordingFile;
  transcript?: IMeetingRecordingTranscript;
  aiSummary?: IMeetingRecordingAiSummary;
  visibility: 'organization' | 'team' | 'participants' | 'private';
  participants: IMeetingRecordingParticipant[];
  processingStatus: 'uploading' | 'processing' | 'completed' | 'failed';
  processingProgress: number;
  tags?: string[];
  isArchived: boolean;
  archiveDate?: Date;
  retentionPolicy?: {
    deleteAfterDays?: number;
    lastAccessDate?: Date;
  };
  analytics: {
    viewCount: number;
    downloadCount: number;
    lastViewed?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IMeetingRecordingMethods {
  canAccess: (userId: mongoose.Types.ObjectId | string, userRole?: string) => Promise<boolean>;
  incrementViewCount: () => Promise<IMeetingRecordingDocument>;
  incrementDownloadCount: () => Promise<IMeetingRecordingDocument>;
}

export interface IMeetingRecordingStatics extends Model<IMeetingRecordingDocument, {}, IMeetingRecordingMethods> {
  findByOrganization: (organizationId: any, options?: Record<string, any>) => Promise<any[]>;
  getStorageStats: (organizationId: any) => Promise<any[]>;
}

export interface IMeetingRecordingDocument extends IMeetingRecording, Document, IMeetingRecordingMethods {
  isProcessing: boolean;
  hasTranscript: boolean;
  hasSummary: boolean;
}

export const meetingRecordingSchema = new Schema<IMeetingRecordingDocument, IMeetingRecordingStatics, IMeetingRecordingMethods>(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: false,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      index: true,
      default: null,
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
    recording: {
      fileName: String,
      fileSize: Number,
      duration: Number,
      format: String,
      quality: String,
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
    transcript: {
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
      },
      text: String,
      segments: [
        {
          startTime: Number,
          endTime: Number,
          speaker: String,
          text: String,
          confidence: Number,
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
      fileName: String,
      fileUrl: String,
    },
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
        overall: String,
        score: Number,
      },
      processingProvider: {
        type: String,
        enum: ['openai', 'claude', 'gemini'],
      },
    },
    visibility: {
      type: String,
      enum: ['organization', 'team', 'participants', 'private'],
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
        speakingTime: Number,
      },
    ],
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
    tags: [String],
    isArchived: {
      type: Boolean,
      default: false,
    },
    archiveDate: Date,
    retentionPolicy: {
      deleteAfterDays: Number,
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

// Indexes
meetingRecordingSchema.index({ organizationId: 1, createdAt: -1 });
meetingRecordingSchema.index({ organizationId: 1, teamId: 1 });
meetingRecordingSchema.index({ teamId: 1, createdAt: -1 });
meetingRecordingSchema.index({ meetingId: 1 });
meetingRecordingSchema.index({ 'participants.userId': 1 });
meetingRecordingSchema.index({ tags: 1 });
meetingRecordingSchema.index({ processingStatus: 1 });
meetingRecordingSchema.index({ 'transcript.status': 1 });
meetingRecordingSchema.index({ 'aiSummary.status': 1 });

// Virtuals
meetingRecordingSchema.virtual('isProcessing').get(function (this: IMeetingRecordingDocument) {
  return ['uploading', 'processing'].includes(this.processingStatus);
});

meetingRecordingSchema.virtual('hasTranscript').get(function (this: IMeetingRecordingDocument) {
  return this.transcript?.status === 'completed';
});

meetingRecordingSchema.virtual('hasSummary').get(function (this: IMeetingRecordingDocument) {
  return this.aiSummary?.status === 'completed';
});

// Instance methods
meetingRecordingSchema.methods.canAccess = async function (
  this: IMeetingRecordingDocument,
  userId: any,
  userRole?: string
): Promise<boolean> {
  if (userRole === 'owner' || userRole === 'admin') return true;
  if (this.visibility === 'organization') return true;

  if (this.visibility === 'team') {
    if (!this.teamId) return false;

    const User = mongoose.model('User');
    const user = await User.findById(userId);
    if (!user) return false;

    const isTeamMember = (user as any).teamMemberships?.some(
      (m: any) =>
        m.teamId.toString() === this.teamId!.toString() &&
        m.organizationId.toString() === this.organizationId.toString() &&
        m.status === 'active'
    );

    return isTeamMember;
  }

  if (this.visibility === 'private' || this.visibility === 'participants') {
    return this.participants.some(
      (p) => p.userId.toString() === userId.toString()
    );
  }

  return false;
};

meetingRecordingSchema.methods.incrementViewCount = async function (this: IMeetingRecordingDocument) {
  this.analytics.viewCount += 1;
  this.analytics.lastViewed = new Date();
  if (this.retentionPolicy) {
    this.retentionPolicy.lastAccessDate = new Date();
  }
  return this.save();
};

meetingRecordingSchema.methods.incrementDownloadCount = async function (this: IMeetingRecordingDocument) {
  this.analytics.downloadCount += 1;
  return this.save();
};

// Static methods
meetingRecordingSchema.statics.findByOrganization = function (
  organizationId: any,
  options: Record<string, any> = {}
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
    teamId,
  } = options;

  const query: Record<string, any> = { organizationId };

  if (teamId) {
    query.teamId = teamId;
  }

  if (isArchived !== undefined) {
    query.isArchived = isArchived;
  } else {
    query.isArchived = false;
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
    .then((recordings: any[]) => {
      return recordings.map((recording) => {
        if (recording.participants) {
          recording.participants = recording.participants.map((participant: any) => {
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

meetingRecordingSchema.statics.getStorageStats = function (organizationId: any) {
  return this.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isArchived: { $ne: true },
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
export const createMeetingRecordingModel = (connection: Connection) => {
  return connection.model<IMeetingRecordingDocument, IMeetingRecordingStatics>('MeetingRecording', meetingRecordingSchema);
};

export default mongoose.model<IMeetingRecordingDocument, IMeetingRecordingStatics>('MeetingRecording', meetingRecordingSchema);
