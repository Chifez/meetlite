import api from '@/lib/axios';
import { extractData } from '@/lib/api-response';

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
        `/api/v1/analytics/organization/${organizationId}`
      );
      const data = extractData<{ analytics: any }>(response);
      return data.analytics;
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
      const response = await api.get(`/api/v1/analytics/recordings/stats`, {
        params: { organizationId },
      });
      const data = extractData<{ stats: any }>(response);
      return data.stats;
    } catch (error: any) {
      console.error('Failed to fetch recording stats:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to fetch recording stats'
      );
    }
  }
}
