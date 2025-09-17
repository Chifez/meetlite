export interface MeetingRecording {
  _id?: string;
  id: string;
  meetingId: string;
  organizationId: string;
  title: string;
  description?: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  visibility: 'organization' | 'participants' | 'private';
  recording: {
    fileName: string;
    fileSize: number;
    duration: number;
    format: string;
    quality: string;
    downloadUrl: string;
    streamingUrl: string;
    thumbnailUrl?: string;
  };
  transcript: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    text?: string;
    fileName?: string;
    isArchived?: boolean;
    fileUrl?: string;
    language: string;
    segments?: Array<{
      startTime: number;
      endTime: number;
      speaker: string;
      text: string;
      confidence: number;
    }>;
  };
  aiSummary: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    summary?: string;
    keyPoints: string[];
    actionItems: Array<{
      task: string;
      assignee?: string;
      dueDate?: string;
      priority: 'low' | 'medium' | 'high';
    }>;
    topics: string[];
    sentiment?: {
      overall: string;
      score: number;
    };
  };
  participants: Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
    joinTime: Date;
    leaveTime?: Date;
    isHost: boolean;
  }>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isArchived?: boolean;
  archiveDate?: Date;
  processingProgress?: number;
  analytics: {
    viewCount: number;
    downloadCount: number;
    lastViewed?: Date;
    averageWatchTime?: number;
  };
  retentionPolicy: {
    deleteAfterDays?: number;
    lastAccessDate: Date;
    expiresAt?: Date;
  };
  shareableUrl?: string;
  shareExpiry?: Date;
}

export interface MeetingAssetsQuery {
  search?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  durationMin?: number;
  durationMax?: number;
  status?: string[];
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'title' | 'duration' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
  isArchived?: boolean;
}

export interface MeetingAssetsResponse {
  recordings: MeetingRecording[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalRecordings: number;
    totalSize: number;
    totalDuration: number;
    completedTranscripts: number;
    completedSummaries: number;
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  estimatedTime?: number;
  error?: string;
}

export interface ShareLinkResponse {
  shareableUrl: string;
  expiresAt: Date;
}

export interface ProcessingResponse {
  message: string;
  status: string;
  estimatedTime?: number;
  error?: string;
}
