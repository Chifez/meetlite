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
    organizationId?: string,
    query: MeetingAssetsQuery = {}
  ): Promise<MeetingAssetsResponse> {
    try {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.set(key, value.toString());
          }
        }
      });

      const response = await api.get(
        `${env.ROOM_API_URL}/recordings?${params}`
      );

      return {
        recordings: response.data.recordings || [],
        pagination: response.data.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
        stats: {
          totalRecordings: 0,
          totalSize: 0,
          totalDuration: 0,
          completedTranscripts: 0,
          completedSummaries: 0,
        },
      };
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
        `${env.ROOM_API_URL}/recordings/${recordingId}`
      );
      return response.data.recording;
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
      const response = await api.put(
        `${env.ROOM_API_URL}/recordings/${recordingId}`,
        updates
      );
      return response.data.recording;
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
        `${env.ROOM_API_URL}/recordings/${recordingId}`
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
        `${env.ROOM_API_URL}/recordings/${recordingId}/process`,
        { type }
      );
      return {
        id: response.data.processingId,
        type,
        status: 'processing',
        progress: 0,
      };
    } catch (error: any) {
      console.error('Failed to start processing:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to start processing'
      );
    }
  }

  // Get processing status
  async getProcessingStatus(recordingId: string): Promise<ProcessingJob> {
    try {
      const response = await api.get(
        `${env.ROOM_API_URL}/recordings/${recordingId}/status`
      );
      return {
        id: recordingId,
        type: 'both',
        status: response.data.status.overall,
        progress: response.data.status.progress,
      };
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
      // For now, create a text blob from the transcript text
      const recording = await this.getRecording(recordingId);
      const transcriptText =
        recording.transcript.text || 'No transcript available';
      const blob = new Blob([transcriptText], { type: 'text/plain' });
      return blob;
    } catch (error: any) {
      console.error('Failed to download transcript:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to download transcript'
      );
    }
  }

  // Stream video recording
  getStreamingUrl(recordingId: string): string {
    return `${env.ROOM_API_URL}/recordings/${recordingId}/download`;
  }

  // Track analytics (handled automatically by backend when accessing recordings)
  async trackView(recordingId: string): Promise<void> {
    // Analytics are tracked automatically when calling getRecording()
    // No need for separate tracking
  }

  async trackDownload(recordingId: string): Promise<void> {
    // Analytics are tracked automatically when calling download endpoint
    // No need for separate tracking
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
      const query: MeetingAssetsQuery = {
        search: searchTerm,
        tags: filters.tags,
        dateFrom: filters.dateRange?.from,
        dateTo: filters.dateRange?.to,
      };

      const response = await this.getOrganizationRecordings(
        organizationId,
        query
      );
      return response.recordings;
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
      // For now, get all recordings and create a simple export
      const response = await this.getOrganizationRecordings(
        organizationId,
        filters
      );

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.recordings, null, 2)], {
          type: 'application/json',
        });
        return blob;
      } else if (format === 'csv') {
        // Simple CSV export
        const headers = [
          'Title',
          'Duration',
          'Created',
          'Status',
          'Transcript Status',
          'Summary Status',
        ];
        const rows = response.recordings.map((r) => [
          r.title,
          `${Math.round(r.recording.duration / 60)}m`,
          new Date(r.createdAt).toLocaleDateString(),
          r.processingStatus,
          r.transcript.status,
          r.aiSummary.status,
        ]);

        const csvContent = [headers, ...rows]
          .map((row) => row.join(','))
          .join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        return blob;
      }

      throw new Error(`Export format ${format} not supported yet`);
    } catch (error: any) {
      console.error('Failed to export recordings:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to export recordings'
      );
    }
  }

  // Upload new recording
  async uploadRecording(
    file: File,
    metadata: {
      title: string;
      description?: string;
      meetingId?: string;
      visibility?: 'organization' | 'participants' | 'private';
      tags?: string[];
    }
  ): Promise<MeetingRecording> {
    try {
      const formData = new FormData();
      formData.append('recording', file);
      formData.append('title', metadata.title);

      if (metadata.description) {
        formData.append('description', metadata.description);
      }
      if (metadata.meetingId) {
        formData.append('meetingId', metadata.meetingId);
      }
      if (metadata.visibility) {
        formData.append('visibility', metadata.visibility);
      }
      if (metadata.tags) {
        formData.append('tags', metadata.tags.join(','));
      }

      const response = await api.post(
        `${env.ROOM_API_URL}/recordings`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data.recording;
    } catch (error: any) {
      console.error('Failed to upload recording:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to upload recording'
      );
    }
  }

  // Get organization statistics
  async getOrganizationStats(): Promise<{
    totalRecordings: number;
    totalSize: number;
    totalDuration: number;
    completedTranscripts: number;
    completedSummaries: number;
  }> {
    try {
      const response = await api.get(`${env.ROOM_API_URL}/recordings/stats`);
      return response.data.stats;
    } catch (error: any) {
      console.error('Failed to get organization stats:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to get statistics'
      );
    }
  }
}

export const meetingAssetsService = new MeetingAssetsService();
