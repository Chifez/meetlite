import { models } from '../index.js';
import { AppError, ResponseHelpers } from '@minimeet/shared';

export class AnalyticsController {
  /**
   * GET /analytics/organization/:organizationId - Get organization analytics
   */
  async getOrganizationAnalytics(req, res) {
    const { organizationId } = req.params;

    if (!organizationId) {
      throw AppError.validation('Organization ID is required');
    }

    // Get basic recording stats (exclude archived recordings)
    const recordings = await models.MeetingRecording.find({
      organizationId: organizationId,
      isArchived: { $ne: true }, // Exclude archived recordings
    });

    const totalRecordings = recordings.length;
    const totalSize = recordings.reduce(
      (sum, recording) => sum + (recording.recording.fileSize || 0),
      0
    );
    const totalDuration = recordings.reduce(
      (sum, recording) => sum + (recording.recording.duration || 0),
      0
    );

    // Count completed transcripts and summaries
    const completedTranscripts = recordings.filter(
      (r) => r.transcript?.status === 'completed'
    ).length;

    const completedSummaries = recordings.filter(
      (r) => r.aiSummary?.status === 'completed'
    ).length;

    // Get recordings from this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const recordingsThisMonth = recordings.filter(
      (r) => r.createdAt >= startOfMonth
    ).length;

    // Calculate average duration
    const averageRecordingDuration =
      totalRecordings > 0 ? Math.round(totalDuration / totalRecordings) : 0;

    // Mock storage percentage (you can implement actual storage limits)
    const storageUsedPercentage = Math.min(
      100,
      Math.round((totalSize / (1024 * 1024 * 1024)) * 10)
    ); // Rough calculation

    const analytics = {
      totalRecordings,
      totalSize,
      totalDuration,
      completedTranscripts,
      completedSummaries,
      averageRecordingDuration,
      recordingsThisMonth,
      storageUsedPercentage,
      lastUpdated: new Date().toISOString(),
    };

    // Return in format expected by frontend: { success: true, analytics: {...} }
    return res.json({
      success: true,
      analytics,
    });
  }

  /**
   * GET /analytics/recordings/stats - Get recording statistics
   */
  async getRecordingStats(req, res) {
    const { organizationId } = req.query;

    if (!organizationId) {
      throw AppError.validation('Organization ID is required');
    }

    const stats = await models.MeetingRecording.getStorageStats(organizationId);

    // Return in format expected by frontend: { success: true, stats: {...} }
    return res.json({
      success: true,
      stats: stats[0] || {
        totalRecordings: 0,
        totalSize: 0,
        totalDuration: 0,
        completedTranscripts: 0,
        completedSummaries: 0,
      },
    });
  }
}

