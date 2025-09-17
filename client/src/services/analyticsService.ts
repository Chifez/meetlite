import { env } from '@/config/env';
import api from '@/lib/axios';

export class AnalyticsService {
  // Get organization analytics
  async getOrganizationAnalytics(organizationId: string): Promise<{
    totalRecordings: number;
    totalSize: number;
    totalDuration: number;
    completedTranscripts: number;
    completedSummaries: number;
  }> {
    try {
      const response = await api.get(
        `${env.ROOM_API_URL}/analytics/organization/${organizationId}`
      );
      return response.data.analytics;
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to fetch analytics'
      );
    }
  }

  // Get recording statistics
  async getRecordingStats(organizationId: string): Promise<{
    totalRecordings: number;
    totalSize: number;
    totalDuration: number;
    completedTranscripts: number;
    completedSummaries: number;
  }> {
    try {
      const response = await api.get(
        `${env.ROOM_API_URL}/analytics/recordings/stats`,
        {
          params: { organizationId },
        }
      );
      return response.data.stats;
    } catch (error: any) {
      console.error('Failed to fetch recording stats:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to fetch recording stats'
      );
    }
  }
}
