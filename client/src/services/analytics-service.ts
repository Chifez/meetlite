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
      const data = extractData<any>(response);

      // Handle different response structures
      if (data?.analytics) {
        return data.analytics;
      }
      if (data && typeof data === 'object' && 'totalRecordings' in data) {
        // Response might be the analytics object directly
        return data;
      }

      // Return default values if structure is unexpected
      console.warn('Unexpected analytics response structure:', data);
      return {
        totalRecordings: 0,
        totalSize: 0,
        totalDuration: 0,
        completedTranscripts: 0,
        completedSummaries: 0,
      };
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error);
      // Return default values instead of throwing to prevent breaking the recordings page
      return {
        totalRecordings: 0,
        totalSize: 0,
        totalDuration: 0,
        completedTranscripts: 0,
        completedSummaries: 0,
      };
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
