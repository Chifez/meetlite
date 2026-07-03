import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
import {
  MeetingRecording,
  MeetingAssetsQuery,
  MeetingAssetsResponse,
} from '@/types/meetingAssets';

export class RecordingService {
  // Get organization's meeting recordings with filtering and pagination
  async getOrganizationRecordings(
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

      const response = await api.get('/api/recordings', {
        params,
      });

      // Handle backend response structure: { success: true, recordings: [...], pagination: {...} }
      if (response.data && typeof response.data === 'object') {
        if ('success' in response.data && response.data.success) {
          // Backend returns data directly, not nested under 'data'
          return {
            recordings: response.data.recordings || [],
            pagination: response.data.pagination || {
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            },
            stats: response.data.stats || {
              totalRecordings: 0,
              totalSize: 0,
              totalDuration: 0,
              completedTranscripts: 0,
              completedSummaries: 0,
            },
          } as MeetingAssetsResponse;
        }
      }

      // Fallback to extractData for other formats
      return extractData<MeetingAssetsResponse>(response);
    } catch (error: any) {
      console.error('Failed to fetch recordings:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to fetch recordings'
      );
    }
  }

  // Get a specific recording by ID
  async getRecordingById(recordingId: string): Promise<MeetingRecording> {
    try {
      const response = await api.get(`/api/recordings/${recordingId}`);
      return extractData<MeetingRecording>(response);
    } catch (error: any) {
      console.error('Failed to fetch recording:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to fetch recording'
      );
    }
  }

  // Delete a recording
  async deleteRecording(recordingId: string): Promise<void> {
    try {
      await api.delete(`/api/recordings/${recordingId}`);
    } catch (error: any) {
      console.error('Failed to delete recording:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to delete recording'
      );
    }
  }

  // Archive a recording
  async archiveRecording(recordingId: string): Promise<void> {
    try {
      await api.post(`/api/recordings/${recordingId}/archive`);
    } catch (error: any) {
      console.error('Failed to archive recording:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to archive recording'
      );
    }
  }

  // Unarchive a recording
  async unarchiveRecording(recordingId: string): Promise<void> {
    try {
      await api.post(`/api/recordings/${recordingId}/unarchive`);
    } catch (error: any) {
      console.error('Failed to unarchive recording:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to unarchive recording'
      );
    }
  }

  // Get fresh streaming URLs for a recording
  async getStreamingUrl(recordingId: string): Promise<{
    streamingUrl: string;
    thumbnailUrl?: string;
  }> {
    try {
      const response = await api.get(`/api/recordings/${recordingId}/stream`);
      return extractData<{ streamingUrl: string; thumbnailUrl?: string }>(
        response
      );
    } catch (error: any) {
      console.error('Failed to get streaming URL:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to get streaming URL'
      );
    }
  }

  // Generate a shareable link for a recording
  async generateShareLink(recordingId: string): Promise<{
    shareableUrl: string;
    expiresAt: Date;
  }> {
    try {
      const response = await api.post(`/api/recordings/${recordingId}/share`);
      return extractData<{ shareableUrl: string; expiresAt: Date }>(response);
    } catch (error: any) {
      console.error('Failed to generate share link:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to generate share link'
      );
    }
  }

  // Download a recording
  async downloadRecording(recordingId: string): Promise<void> {
    try {
      const response = await api.get(
        `/api/recordings/${recordingId}/download`,
        {
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recording-${recordingId}.mp4`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to download recording:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to download recording'
      );
    }
  }
}
