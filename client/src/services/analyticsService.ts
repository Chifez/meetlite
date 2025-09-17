import { env } from '@/config/env';
import api from '@/lib/axios';

export interface OrganizationAnalytics {
  totalRecordings: number;
  totalSize: number;
  totalDuration: number;
  completedTranscripts: number;
  completedSummaries: number;
  averageRecordingDuration: number;
  recordingsThisMonth: number;
  storageUsedPercentage: number;
}

export interface RecordingStats {
  totalRecordings: number;
  totalSize: number;
  totalDuration: number;
  completedTranscripts: number;
  completedSummaries: number;
}

class AnalyticsService {
  /**
   * Get organization analytics
   */
  async getOrganizationAnalytics(
    organizationId: string
  ): Promise<OrganizationAnalytics> {
    try {
      const response = await api.get(
        `${env.ROOM_API_URL}/analytics/organization/${organizationId}`
      );
      return response.data.analytics;
    } catch (error) {
      console.error('Failed to fetch organization analytics:', error);
      throw new Error('Failed to fetch analytics');
    }
  }

  /**
   * Get recording statistics
   */
  async getRecordingStats(organizationId: string): Promise<RecordingStats> {
    try {
      const response = await api.get(`${env.ROOM_API_URL}/recordings/stats`, {
        params: { organizationId },
      });
      return response.data.stats;
    } catch (error) {
      console.error('Failed to fetch recording stats:', error);
      throw new Error('Failed to fetch recording statistics');
    }
  }

  /**
   * Get analytics dashboard data
   */
  async getDashboardAnalytics(organizationId: string) {
    try {
      const [analytics, stats] = await Promise.all([
        this.getOrganizationAnalytics(organizationId),
        this.getRecordingStats(organizationId),
      ]);

      return {
        analytics,
        stats,
        // Calculate additional metrics
        averageRecordingDuration:
          stats.totalRecordings > 0
            ? Math.round(stats.totalDuration / stats.totalRecordings)
            : 0,
        storageUsedPercentage: analytics.storageUsedPercentage || 0,
        recordingsThisMonth: analytics.recordingsThisMonth || 0,
      };
    } catch (error) {
      console.error('Failed to fetch dashboard analytics:', error);
      throw new Error('Failed to fetch dashboard data');
    }
  }
}

export const analyticsService = new AnalyticsService();
