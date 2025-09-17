import express from 'express';
import { models } from '../index.js';
import { AppError } from '@minimeet/shared-models';

const router = express.Router();

/**
 * Get organization analytics
 * GET /api/analytics/organization/:organizationId
 */
router.get('/organization/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!organizationId) {
      throw new AppError('SYSTEM_9007', 'Organization ID is required');
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

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('Error fetching organization analytics:', error);

    if (error.isOperational) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organization analytics',
        error: error.message,
      });
    }
  }
});

/**
 * Get recording statistics (alternative endpoint)
 * GET /api/analytics/recordings/stats
 */
router.get('/recordings/stats', async (req, res) => {
  try {
    const { organizationId } = req.query;

    if (!organizationId) {
      throw new AppError('SYSTEM_9007', 'Organization ID is required');
    }

    const stats = await models.MeetingRecording.getStorageStats(organizationId);

    res.json({
      success: true,
      stats: stats[0] || {
        totalRecordings: 0,
        totalSize: 0,
        totalDuration: 0,
        completedTranscripts: 0,
        completedSummaries: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching recording stats:', error);

    if (error.isOperational) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recording statistics',
        error: error.message,
      });
    }
  }
});

export default router;
