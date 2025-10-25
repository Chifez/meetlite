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
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('recording', file);
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

      const response = await api.post(`/api/recordings`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentage = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );

            const progress: UploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage,
            };
            onProgress(progress);
          }
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to upload recording'
      );
    }
  }
}

export const uploadService = new UploadService();
