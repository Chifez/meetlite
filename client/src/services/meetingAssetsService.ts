import api from '@/lib/axios';
import { env } from '@/config/env';

export interface MeetingRecording {
  id: string;
  meetingId: string;
  organizationId: string;
  title: string;
  description?: string;
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
  visibility: 'organization' | 'participants' | 'private';
  participants: Array<{
    userId: string;
    name: string;
    email: string;
    role: 'host' | 'participant' | 'viewer';
    speakingTime?: number;
  }>;
  processingStatus: 'uploading' | 'processing' | 'completed' | 'failed';
  processingProgress: number;
  tags: string[];
  analytics: {
    viewCount: number;
    downloadCount: number;
    lastViewed?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MeetingAssetsQuery {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'title' | 'duration' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
  status?: 'uploading' | 'processing' | 'completed' | 'failed';
  tags?: string[];
  search?: string;
  hasTranscript?: boolean;
  hasSummary?: boolean;
  dateFrom?: string;
  dateTo?: string;
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

export interface ProcessingJob {
  id: string;
  type: 'transcript' | 'summary' | 'both';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  estimatedTime?: number;
  error?: string;
}

class MeetingAssetsService {
  // Get organization's meeting recordings with filtering and pagination
  async getOrganizationRecordings(
    organizationId: string,
    query: MeetingAssetsQuery = {}
  ): Promise<MeetingAssetsResponse> {
    try {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, v));
          } else {
            params.set(key, value.toString());
          }
        }
      });

      const response = await api.get(
        `${env.ROOM_API_URL}/meetings/recordings/organization/${organizationId}?${params}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch meeting recordings:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to fetch recordings'
      );
    }
  }

  // Get specific recording details
  async getRecording(recordingId: string): Promise<MeetingRecording> {
    try {
      const response = await api.get(
        `${env.ROOM_API_URL}/meetings/recordings/${recordingId}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch recording:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to fetch recording'
      );
    }
  }

  // Update recording metadata
  async updateRecording(
    recordingId: string,
    updates: {
      title?: string;
      description?: string;
      tags?: string[];
      visibility?: 'organization' | 'participants' | 'private';
    }
  ): Promise<MeetingRecording> {
    try {
      const response = await api.patch(
        `${env.ROOM_API_URL}/meetings/recordings/${recordingId}`,
        updates
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to update recording:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to update recording'
      );
    }
  }

  // Delete recording
  async deleteRecording(recordingId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete(
        `${env.ROOM_API_URL}/meetings/recordings/${recordingId}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to delete recording:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to delete recording'
      );
    }
  }

  // Start AI processing (transcript/summary)
  async startProcessing(
    recordingId: string,
    type: 'transcript' | 'summary' | 'both'
  ): Promise<ProcessingJob> {
    try {
      const response = await api.post(
        `${env.ROOM_API_URL}/meetings/recordings/${recordingId}/process`,
        { type }
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to start processing:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to start processing'
      );
    }
  }

  // Get processing status
  async getProcessingStatus(jobId: string): Promise<ProcessingJob> {
    try {
      const response = await api.get(
        `${env.ROOM_API_URL}/meetings/processing/${jobId}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to get processing status:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to get processing status'
      );
    }
  }

  // Download transcript file
  async downloadTranscript(recordingId: string): Promise<Blob> {
    try {
      const response = await api.get(
        `${env.ROOM_API_URL}/meetings/recordings/${recordingId}/transcript/download`,
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to download transcript:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to download transcript'
      );
    }
  }

  // Stream video recording
  getStreamingUrl(recordingId: string): string {
    return `${env.ROOM_API_URL}/meetings/recordings/${recordingId}/stream`;
  }

  // Track analytics
  async trackView(recordingId: string): Promise<void> {
    try {
      await api.post(
        `${env.ROOM_API_URL}/meetings/recordings/${recordingId}/view`
      );
    } catch (error: any) {
      console.error('Failed to track view:', error);
      // Don't throw error for analytics
    }
  }

  async trackDownload(recordingId: string): Promise<void> {
    try {
      await api.post(
        `${env.ROOM_API_URL}/meetings/recordings/${recordingId}/download`
      );
    } catch (error: any) {
      console.error('Failed to track download:', error);
      // Don't throw error for analytics
    }
  }

  // Search recordings with advanced filters
  async searchRecordings(
    organizationId: string,
    searchTerm: string,
    filters: {
      dateRange?: { from: string; to: string };
      participants?: string[];
      tags?: string[];
      minDuration?: number;
      maxDuration?: number;
    } = {}
  ): Promise<MeetingRecording[]> {
    try {
      const response = await api.post(
        `${env.ROOM_API_URL}/meetings/recordings/search`,
        {
          organizationId,
          searchTerm,
          filters,
        }
      );
      return response.data.recordings;
    } catch (error: any) {
      console.error('Failed to search recordings:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to search recordings'
      );
    }
  }

  // Export recordings data
  async exportRecordings(
    organizationId: string,
    format: 'csv' | 'json' | 'pdf',
    filters: MeetingAssetsQuery = {}
  ): Promise<Blob> {
    try {
      const response = await api.post(
        `${env.ROOM_API_URL}/meetings/recordings/export`,
        { organizationId, format, filters },
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to export recordings:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to export recordings'
      );
    }
  }
}

export const meetingAssetsService = new MeetingAssetsService();
