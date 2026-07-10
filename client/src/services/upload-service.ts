import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';
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
      teamId?: string;
      visibility?: 'organization' | 'team' | 'participants' | 'private';
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
      if (metadata.teamId) {
        formData.append('teamId', metadata.teamId);
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

      return extractData<any>(response);
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to upload recording'
      );
    }
  }

  // Generate presigned URL and upload file directly to S3
  async uploadLogo(
    orgId: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
  ): Promise<string> {
    try {
      // Step 1: Get presigned URL
      const ext = file.name.split('.').pop() || 'png';
      const urlResponse = await api.get(`/api/organizations/${orgId}/upload-url`, {
        params: {
          contentType: file.type,
          fileExtension: ext,
        },
      });

      const { uploadUrl, publicUrl } = urlResponse.data;

      // Step 2: Upload directly to S3 using PUT
      // Note: We don't use api instance here because it includes auth headers
      // which S3 will reject (SignatureDoesNotMatch). We use fetch or naked axios.
      const uploadReq = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        uploadReq.upload.addEventListener('progress', (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentage = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress({
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage,
            });
          }
        });

        uploadReq.addEventListener('load', () => {
          if (uploadReq.status >= 200 && uploadReq.status < 300) {
            resolve(publicUrl);
          } else {
            reject(new Error(`Failed to upload to S3: ${uploadReq.statusText}`));
          }
        });

        uploadReq.addEventListener('error', () => {
          reject(new Error('Network error during S3 upload'));
        });

        if (signal) {
          signal.addEventListener('abort', () => {
            uploadReq.abort();
            reject(new Error('Upload aborted'));
          });
        }

        uploadReq.open('PUT', uploadUrl);
        uploadReq.setRequestHeader('Content-Type', file.type);
        uploadReq.send(file);
      });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || error.message || 'Failed to upload logo'
      );
    }
  }
}

export const uploadService = new UploadService();
