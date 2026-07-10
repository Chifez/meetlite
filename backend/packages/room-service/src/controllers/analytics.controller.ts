import { Request, Response } from 'express';
import { prisma } from '@minimeet/shared';
import { AppError } from '@minimeet/shared';

export class AnalyticsController {
  /**
   * GET /analytics/organization/:organizationId - Get organization analytics
   */
  async getOrganizationAnalytics(req: Request, res: Response) {
    const { organizationId } = req.params;

    if (!organizationId) {
      throw AppError.validation('Organization ID is required');
    }

    const recordings = await prisma.meetingRecording.findMany({
      where: {
        organizationId: organizationId as string,
        isArchived: false,
      }
    });

    const totalRecordings = recordings.length;
    const totalSize = recordings.reduce(
      (sum: number, recording: any) => sum + Number(recording.fileSize || 0),
      0
    );
    const totalDuration = recordings.reduce(
      (sum: number, recording: any) => sum + Number(recording.duration || 0),
      0
    );

    // Count completed transcripts and summaries
    const completedTranscripts = recordings.filter(
      (r: any) => r.transcriptStatus === 'completed'
    ).length;

    const completedSummaries = recordings.filter(
      (r: any) => r.summaryStatus === 'completed'
    ).length;

    // Get recordings from this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const recordingsThisMonth = recordings.filter(
      (r: any) => r.createdAt >= startOfMonth
    ).length;

    // Calculate average duration
    const averageRecordingDuration =
      totalRecordings > 0 ? Math.round(totalDuration / totalRecordings) : 0;

    // Mock storage percentage
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

    return res.json({
      success: true,
      analytics,
    });
  }

  /**
   * GET /analytics/recordings/stats - Get recording statistics
   */
  async getRecordingStats(req: Request, res: Response) {
    const { organizationId } = req.query as any;

    if (!organizationId) {
      throw AppError.validation('Organization ID is required');
    }

    const aggregates = await prisma.meetingRecording.aggregate({
      where: { organizationId: organizationId as string },
      _sum: { fileSize: true, duration: true },
      _count: { id: true }
    });

    const transcriptsCount = await prisma.meetingRecording.count({
      where: { organizationId: organizationId as string, transcriptStatus: 'completed' }
    });

    const summariesCount = await prisma.meetingRecording.count({
      where: { organizationId: organizationId as string, summaryStatus: 'completed' }
    });

    return res.json({
      success: true,
      stats: {
        totalRecordings: aggregates._count.id,
        totalSize: Number(aggregates._sum.fileSize || 0),
        totalDuration: Number(aggregates._sum.duration || 0),
        completedTranscripts: transcriptsCount,
        completedSummaries: summariesCount,
      },
    });
  }
}
