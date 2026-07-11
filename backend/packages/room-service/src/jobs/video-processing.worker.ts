import { Job } from 'bullmq';
import { BaseWorker } from '@minimeet/shared';
import { prisma } from '@minimeet/shared';
import fs from 'fs/promises';
import {
  uploadVideoFile,
  generateSignedUrl,
  checkR2Config,
} from '../services/cloudflare-r2.service.js';
import {
  transcribeRecording,
  generateRecordingSummary,
} from '../services/ai.service.js';

/**
 * VideoProcessingWorker
 * Processes queued video recordings: uploads to R2, generates transcript & summary.
 */
export class VideoProcessingWorker extends BaseWorker {
  constructor(options: Record<string, any> = {}) {
    const processJob = async function (this: VideoProcessingWorker, job: Job) {
      return await this.processVideoJob(job);
    };

    super('video-processing', processJob, {
      db: parseInt(process.env.BULL_REDIS_DB || '2'),
      prefix: 'bull:video-processing',
      concurrency: parseInt(process.env.VIDEO_WORKER_CONCURRENCY || '2'),
      ...options,
    });
  }

  async processVideoJob(job: Job): Promise<any> {
    const {
      recordingId,
      tempFilePath,
      fileName,
      organizationId,
      duration,
      participants,
      startedBy,
      roomId,
    } = job.data;

    console.log(`[VideoProcessingWorker] Processing job ${job.id} for recording ${recordingId}`);

    // 1. Verify the recording record still exists
    const recording = await prisma.meetingRecording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      console.warn(`[VideoProcessingWorker] Recording ${recordingId} not found in DB, skipping`);
      return { skipped: true, reason: 'Recording not found' };
    }

    // 2. Check R2 is configured
    if (!checkR2Config()) {
      throw new Error('R2 storage not configured – cannot process recording');
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(tempFilePath);
    } catch (err: any) {
      throw new Error(`Could not read temp recording file at ${tempFilePath}: ${err.message}`);
    }

    await job.updateProgress(10);

    // 3. Upload to Cloudflare R2
    const uploadResult = await uploadVideoFile(fileBuffer, {
      fileName,
      organizationId: organizationId || 'personal',
      recordingId,
      fileFormat: 'webm',
    });

    await job.updateProgress(50);

    // 4. Generate signed URLs
    const signedStreamingUrl = await generateSignedUrl(uploadResult.key, { expiresIn: 3600 });
    const signedDownloadUrl = await generateSignedUrl(uploadResult.key, { expiresIn: 3600 });

    // 5. Update DB record with storage info
    await prisma.meetingRecording.update({
      where: { id: recordingId },
      data: {
        storagePath: uploadResult.key,
        downloadUrl: signedDownloadUrl,
        streamingUrl: signedStreamingUrl,
        thumbnailUrl: uploadResult.thumbnailUrl || null,
        duration: uploadResult.duration || duration || 0,
        quality: uploadResult.quality || 'unknown',
        processingStatus: 'processing',
        transcriptStatus: 'pending',
        summaryStatus: 'pending',
      },
    });

    await job.updateProgress(70);

    // 6. Delete temp file now that it's safely on R2
    await fs.unlink(tempFilePath).catch(() => {});

    await job.updateProgress(80);

    // 7. Kick off AI processing in background (non-blocking)
    const updatedRecording = await prisma.meetingRecording.findUnique({
      where: { id: recordingId },
      include: { participants: { include: { user: { select: { name: true, email: true } } } } },
    });

    if (updatedRecording) {
      runAIProcessing(updatedRecording).catch((err) =>
        console.error('[VideoProcessingWorker] AI processing failed:', err)
      );
    }

    await job.updateProgress(100);

    console.log(`[VideoProcessingWorker] Job ${job.id} complete – recording ${recordingId} uploaded to R2`);
    return { success: true, recordingId, storagePath: uploadResult.key };
  }
}

/**
 * Run transcript + summary generation asynchronously after the video is on R2.
 */
async function runAIProcessing(recording: any) {
  try {
    let transcriptText: string | null = null;

    // Transcript
    try {
      const transcriptData = await transcribeRecording(recording.streamingUrl);
      transcriptText = transcriptData.text;

      await prisma.meetingRecording.update({
        where: { id: recording.id },
        data: {
          transcriptText: transcriptData.text,
          transcriptLanguage: transcriptData.language,
          transcriptStatus: 'completed',
          transcriptProvider: 'openai',
        },
      });
    } catch (err) {
      console.error('[VideoProcessingWorker] Transcription failed:', err);
      await prisma.meetingRecording.update({
        where: { id: recording.id },
        data: { transcriptStatus: 'failed' },
      });
    }

    // Summary
    if (transcriptText) {
      try {
        const summaryData = await generateRecordingSummary(transcriptText, {
          meetingContext: recording.description || recording.title,
          participantCount: recording.participants?.length || 0,
          duration: recording.duration,
        });

        await prisma.meetingRecording.update({
          where: { id: recording.id },
          data: {
            summaryText: summaryData.summary,
            summaryKeyPoints: summaryData.keyPoints,
            summaryTopics: summaryData.topics,
            summarySentiment: summaryData.sentiment,
            summaryStatus: 'completed',
            summaryProvider: 'openai',
            processingStatus: 'completed',
          },
        });
      } catch (err) {
        console.error('[VideoProcessingWorker] Summary generation failed:', err);
        await prisma.meetingRecording.update({
          where: { id: recording.id },
          data: { summaryStatus: 'failed', processingStatus: 'failed' },
        });
      }
    } else {
      await prisma.meetingRecording.update({
        where: { id: recording.id },
        data: { processingStatus: 'completed' },
      });
    }
  } catch (err) {
    console.error('[VideoProcessingWorker] runAIProcessing error:', err);
  }
}

export default VideoProcessingWorker;
