import api from '@/lib/axios';
import { ProcessingResponse } from '@/types/meetingAssets';

export class ProcessingService {
  // Start AI processing for a recording
  async startProcessing(
    recordingId: string,
    type: 'transcript' | 'summary' | 'both'
  ): Promise<ProcessingResponse> {
    try {
      const response = await api.post(
        `/api/recordings/${recordingId}/process`,
        {
          type,
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to start processing:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to start processing'
      );
    }
  }

  // Get processing status for a recording
  async getProcessingStatus(recordingId: string): Promise<ProcessingResponse> {
    try {
      const response = await api.get(`/api/recordings/${recordingId}/process`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get processing status:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to get processing status'
      );
    }
  }
}
