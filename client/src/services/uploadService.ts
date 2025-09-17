import api from '@/lib/axios';
import { UploadProgress } from '@/types/meetingAssets';

export class UploadService {
  // Upload a recording file
  async uploadRecording(
    file: File,
    metadata: {
      title: string;
      description?: string;
      tags?: string[];
      meetingId?: string;
      visibility?: 'organization' | 'participants' | 'private';
    },
    onProgress?: (progress: UploadProgress) => void
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', metadata.title);
      if (metadata.description) {
        formData.append('description', metadata.description);
      }
      if (metadata.tags) {
        formData.append('tags', JSON.stringify(metadata.tags));
      }
      if (metadata.meetingId) {
        formData.append('meetingId', metadata.meetingId);
      }
      if (metadata.visibility) {
        formData.append('visibility', metadata.visibility);
      }

      const response = await api.post('/api/recordings/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress: UploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              ),
            };
            onProgress(progress);
          }
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Failed to upload recording:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to upload recording'
      );
    }
  }
}
