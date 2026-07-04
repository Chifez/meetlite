import fs from 'fs/promises';
import { models } from '../index.js';
import { AppError, ResponseHelpers } from '@minimeet/shared';
import {
  uploadVideoFile,
  checkR2Config,
  extractAudioFromVideo,
  generateSignedUrl,
  deleteFile,
} from '../services/cloudflare-r2.service.js';
import {
  transcribeRecording,
  generateRecordingSummary,
} from '../services/ai.service.js';
import { Request, Response } from 'express';

/**
 * Background function to process recording AI (transcript/summary)
 */
async function processRecordingAI(recording: any, type: string, processingId: string) {
  try {
    let transcriptData: any = null;

    // Step 1: Generate transcript if needed
    if (type === 'transcript' || type === 'both') {
      try {
        let audioUrl = recording.recording.streamingUrl;

        // If it's a video, we might need to extract audio
        if (
          recording.recording.format !== 'mp3' &&
          recording.recording.format !== 'wav'
        ) {
          const audioResult = await extractAudioFromVideo(
            recording.recording.storagePath
          );

          if (audioResult.success && audioResult.audioUrl) {
            audioUrl = audioResult.audioUrl;
          }
        }

        transcriptData = await transcribeRecording(audioUrl);

        recording.transcript.text = transcriptData.text;
        recording.transcript.segments = transcriptData.segments;
        recording.transcript.language = transcriptData.language;
        recording.transcript.status = 'completed';
        recording.transcript.processingProvider = 'openai';
      } catch (transcriptError) {
        console.error('Transcript processing failed:', transcriptError);
        recording.transcript.status = 'failed';
      }
    }

    // Step 2: Generate summary if needed
    if (type === 'summary' || type === 'both') {
      try {
        const transcriptText =
          transcriptData?.text || recording.transcript.text;

        if (!transcriptText) {
          throw new Error('No transcript available for summary generation');
        }

        const summaryData = await generateRecordingSummary(transcriptText, {
          meetingContext: recording.description || recording.title,
          participantCount: recording.participants.length,
          duration: recording.recording.duration,
        });

        recording.aiSummary.summary = summaryData.summary;
        recording.aiSummary.keyPoints = summaryData.keyPoints;
        recording.aiSummary.actionItems = summaryData.actionItems;
        recording.aiSummary.topics = summaryData.topics;
        recording.aiSummary.sentiment = summaryData.sentiment;
        recording.aiSummary.status = 'completed';
        recording.aiSummary.processingProvider = 'openai';
      } catch (summaryError) {
        console.error('Summary processing failed:', summaryError);
        recording.aiSummary.status = 'failed';
      }
    }

    // Step 3: Update overall processing status
    const transcriptDone =
      recording.transcript.status === 'completed' || type === 'summary';
    const summaryDone =
      recording.aiSummary.status === 'completed' || type === 'transcript';

    if (transcriptDone && summaryDone) {
      recording.processingStatus = 'completed';
    } else if (
      recording.transcript.status === 'failed' ||
      recording.aiSummary.status === 'failed'
    ) {
      recording.processingStatus = 'failed';
    }

    await recording.save();
  } catch (error) {
    console.error('AI processing failed:', error);

    try {
      recording.processingStatus = 'failed';
      if (type === 'transcript' || type === 'both') {
        recording.transcript.status = 'failed';
      }
      if (type === 'summary' || type === 'both') {
        recording.aiSummary.status = 'failed';
      }
      await recording.save();
    } catch (saveError) {
      console.error('Failed to update recording status:', saveError);
    }
  }
}

export class RecordingController {
  /**
   * POST /recordings - Upload a new recording
   */
  async uploadRecording(req: any, res: Response) {
    if (req.fileValidationError) {
      throw AppError.validation(req.fileValidationError);
    }

    if (!req.file) {
      throw AppError.validation('No recording file provided');
    }

    const {
      title,
      description,
      meetingId,
      visibility = 'participants',
      tags = [],
    } = req.body;

    if (!title) {
      throw AppError.validation('Title is required');
    }

    if (!req.user.organizationId) {
      throw AppError.validation(
        'User must belong to an organization to upload recordings'
      );
    }

    if (!req.user.userId) {
      throw AppError.unauthorized('Invalid user token - missing userId');
    }

    if (meetingId) {
      const meeting = await models.Meeting.findById(meetingId);
      if (!meeting) {
        throw AppError.notFound('Meeting');
      }

      const hasAccess =
        meeting.host.userId.toString() === req.user.userId ||
        meeting.participants.some((p: any) => p.email === req.user.email);

      if (!hasAccess) {
        throw AppError.forbidden('Access denied to this meeting');
      }
    }

    if (!checkR2Config()) {
      throw AppError.internal('File storage service not configured properly');
    }

    const recording = new (models as any).MeetingRecording({
      meetingId: meetingId || null,
      organizationId: req.user.organizationId || null,
      teamId: req.body.teamId || null,
      title: title.trim(),
      description: description?.trim(),
      recording: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        format: req.file.mimetype.split('/')[1],
        storageProvider: 'r2',
        storagePath: null,
        downloadUrl: null,
        streamingUrl: null,
        thumbnailUrl: null,
      },
      visibility,
      tags: Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
        ? tags.split(',').map((t: string) => t.trim())
        : [],
      processingStatus: 'uploading',
      participants: [
        {
          userId: req.user.userId,
          role: 'host',
          joinTime: new Date(),
        },
      ],
    });

    try {
      await recording.save();
    } catch (saveError: any) {
      console.error('Database save error:', saveError);
      throw AppError.internal(`Failed to save recording: ${saveError.message}`);
    }

    let tempFilePath = req.file.path;

    try {
      const fileBuffer = await fs.readFile(tempFilePath);

      const uploadResult = await uploadVideoFile(fileBuffer, {
        fileName: req.file.originalname,
        organizationId: req.user.organizationId,
        recordingId: recording._id.toString(),
        fileFormat: req.file.mimetype.split('/')[1],
      });

      recording.recording.storagePath = uploadResult.key;
      recording.recording.downloadUrl = uploadResult.downloadUrl;
      recording.recording.streamingUrl = uploadResult.streamingUrl;
      recording.recording.thumbnailUrl = uploadResult.thumbnailUrl;
      recording.recording.duration = uploadResult.duration || 0;
      recording.recording.quality = uploadResult.quality || 'unknown';
      recording.processingStatus = 'completed';

      await recording.save();

      const signedStreamingUrl = await generateSignedUrl(uploadResult.key, {
        expiresIn: 3600,
      });
      const signedDownloadUrl = await generateSignedUrl(uploadResult.key, {
        expiresIn: 3600,
      });

      recording.recording.streamingUrl = signedStreamingUrl;
      recording.recording.downloadUrl = signedDownloadUrl;
      await recording.save();

      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {}

      return res.status(201).json({
        success: true,
        recording: {
          id: recording._id,
          title: recording.title,
          description: recording.description,
          processingStatus: recording.processingStatus,
          recording: {
            thumbnailUrl: recording.recording.thumbnailUrl,
            duration: recording.recording.duration || 0,
            quality: recording.recording.quality || 'unknown',
            format: recording.recording.format,
          },
          createdAt: recording.createdAt,
        },
        message: 'Recording uploaded and processed successfully.',
      });
    } catch (uploadError: any) {
      console.error('R2 upload failed:', uploadError);

      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {}
      }

      recording.processingStatus = 'failed';
      await recording.save();

      throw AppError.internal(
        `Failed to upload recording to storage: ${uploadError.message}`
      );
    }
  }

  /**
   * GET /recordings - Get recordings list
   */
  async getRecordings(req: any, res: Response) {
    const {
      page = 1,
      limit = 20,
      status,
      tags,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isArchived,
      teamId,
    } = req.query;

    if (!req.user.organizationId) {
      throw AppError.validation(
        'Organization membership required to access recordings'
      );
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      status,
      tags: tags ? tags.split(',') : undefined,
      search,
      isArchived:
        isArchived === 'true'
          ? true
          : isArchived === 'false'
          ? false
          : undefined,
      teamId: teamId || undefined,
    };

    const recordings = await (models as any).MeetingRecording.findByOrganization(
      req.user.organizationId,
      options
    );

    const countQuery: any = { organizationId: req.user.organizationId };
    if (teamId) {
      countQuery.teamId = teamId;
    }
    if (isArchived !== undefined) {
      countQuery.isArchived = isArchived === 'true';
    } else {
      countQuery.isArchived = false;
    }

    const total = await models.MeetingRecording.countDocuments(countQuery);

    return res.json({
      success: true,
      recordings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * GET /recordings/:id - Get recording details
   */
  async getRecording(req: any, res: Response) {
    const recording: any = await (models as any).MeetingRecording.findById(req.params.id)
      .populate('meetingId', 'title scheduledTime')
      .populate('participants.userId', 'name email')
      .lean();

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    if (recording.participants) {
      recording.participants = recording.participants.map((participant: any) => {
        if (participant.userId && typeof participant.userId === 'object') {
          return {
            ...participant,
            name: participant.userId.name || '',
            email: participant.userId.email || '',
            userId: participant.userId._id,
          };
        }
        return participant;
      });
    }

    const recordingDoc = await (models as any).MeetingRecording.findById(req.params.id);
    const canAccess = await recordingDoc.canAccess(
      req.user.userId,
      req.user.role
    );
    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    await (models as any).MeetingRecording.findByIdAndUpdate(req.params.id, {
      $inc: { 'analytics.viewCount': 1 },
      $set: {
        'analytics.lastViewed': new Date(),
        'retentionPolicy.lastAccessDate': new Date(),
      },
    });

    return res.json({
      success: true,
      recording,
    });
  }

  /**
   * GET /recordings/:id/stream - Get fresh signed URL for video streaming
   */
  async getStreamingUrl(req: any, res: Response) {
    const recording = await (models as any).MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canAccess = await recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    const streamingUrl = await generateSignedUrl(
      recording.recording.storagePath,
      { expiresIn: 3600 }
    );

    const thumbnailUrl = recording.recording.thumbnailPath
      ? await generateSignedUrl(recording.recording.thumbnailPath, { expiresIn: 3600 })
      : null;

    return res.json({
      success: true,
      streamingUrl,
      thumbnailUrl,
    });
  }

  /**
   * PUT /recordings/:id - Update recording metadata
   */
  async updateRecording(req: any, res: Response) {
    const recording = await (models as any).MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canEdit =
      recording.participants.some(
        (p: any) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === 'owner' ||
      req.user.role === 'admin';

    if (!canEdit) {
      throw AppError.forbidden('Permission denied to edit this recording');
    }

    const { title, description, tags, visibility } = req.body;

    if (title) recording.title = title.trim();
    if (description !== undefined) recording.description = description?.trim();
    if (tags)
      recording.tags = Array.isArray(tags)
        ? tags
        : tags.split(',').map((t: string) => t.trim());
    if (visibility) recording.visibility = visibility;

    await recording.save();

    return ResponseHelpers.ok(res, recording, 'Recording updated successfully');
  }

  /**
   * DELETE /recordings/:id - Delete recording
   */
  async deleteRecording(req: any, res: Response) {
    const recording = await (models as any).MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canDelete =
      recording.participants.some(
        (p: any) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === 'owner' ||
      req.user.role === 'admin';

    if (!canDelete) {
      throw AppError.forbidden('Permission denied to delete this recording');
    }

    if (recording.recording.storagePath) {
      try {
        await deleteFile(recording.recording.storagePath);
      } catch (error) {
        console.error('Failed to delete file from R2:', error);
      }
    }

    if (recording.recording.thumbnailUrl) {
      try {
        const thumbnailPath = recording.recording.thumbnailUrl
          .split('/')
          .slice(-2)
          .join('/');
        await deleteFile(thumbnailPath);
      } catch (error) {
        console.error('Failed to delete thumbnail from R2:', error);
      }
    }

    await (models as any).MeetingRecording.findByIdAndDelete(req.params.id);

    return ResponseHelpers.ok(res, null, 'Recording deleted successfully');
  }

  /**
   * POST /recordings/:id/process - Start AI processing (transcript/summary)
   */
  async processRecording(req: any, res: Response) {
    const { type = 'both' } = req.body;

    const recording = await (models as any).MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canAccess = await recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    const validTypes = ['transcript', 'summary', 'both'];
    if (!validTypes.includes(type)) {
      throw AppError.validation(
        'Invalid processing type. Must be: transcript, summary, or both'
      );
    }

    if (!recording.recording.streamingUrl) {
      throw AppError.validation('Recording file not available for processing');
    }

    const processingId = `${recording._id}_${type}_${Date.now()}`;

    if (type === 'transcript' || type === 'both') {
      recording.transcript.status = 'processing';
    }
    if (type === 'summary' || type === 'both') {
      recording.aiSummary.status = 'processing';
    }

    await recording.save();

    processRecordingAI(recording, type, processingId).catch((error) => {
      console.error('Background AI processing failed:', error);
    });

    return res.json({
      success: true,
      message: `${type} processing started`,
      processingId,
    });
  }

  /**
   * POST /recordings/:id/share - Generate shareable link for recording
   */
  async shareRecording(req: any, res: Response) {
    const recording = await (models as any).MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canAccess = await recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    const shareToken = Buffer.from(`${recording._id}:${Date.now()}`).toString(
      'base64'
    );

    const shareableUrl = await generateSignedUrl(
      recording.recording.storagePath,
      { expiresIn: 86400 }
    );

    return res.json({
      success: true,
      shareToken,
      shareableUrl,
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
    });
  }

  /**
   * POST /recordings/:id/archive - Archive recording
   */
  async archiveRecording(req: any, res: Response) {
    const recording = await (models as any).MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canArchive =
      recording.participants.some(
        (p: any) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === 'owner' ||
      req.user.role === 'admin';

    if (!canArchive) {
      throw AppError.forbidden('Permission denied to archive this recording');
    }

    recording.isArchived = true;
    recording.archiveDate = new Date();
    await recording.save();

    return ResponseHelpers.ok(res, null, 'Recording archived successfully');
  }

  /**
   * POST /recordings/:id/unarchive - Unarchive recording
   */
  async unarchiveRecording(req: any, res: Response) {
    const recording = await (models as any).MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canUnarchive =
      recording.participants.some(
        (p: any) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === 'owner' ||
      req.user.role === 'admin';

    if (!canUnarchive) {
      throw AppError.forbidden(
        'Permission denied to unarchive this recording'
      );
    }

    recording.isArchived = false;
    recording.archiveDate = undefined;
    await recording.save();

    return ResponseHelpers.ok(res, null, 'Recording unarchived successfully');
  }

  /**
   * GET /recordings/:id/status - Get processing status
   */
  async getRecordingStatus(req: any, res: Response) {
    const recording = await (models as any).MeetingRecording.findById(req.params.id)
      .select(
        'processingStatus processingProgress transcript.status aiSummary.status'
      );

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    return res.json({
      success: true,
      status: {
        overall: recording.processingStatus,
        progress: recording.processingProgress,
        transcript: recording.transcript.status,
        summary: recording.aiSummary.status,
        isProcessing: recording.isProcessing,
      },
    });
  }

  /**
   * GET /recordings/stats - Get organization recording statistics
   */
  async getRecordingStats(req: any, res: Response) {
    if (!req.user.organizationId) {
      throw AppError.validation(
        'Organization membership required for statistics'
      );
    }

    const stats = await (models as any).MeetingRecording.getStorageStats(
      req.user.organizationId
    );

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

  /**
   * GET /recordings/:id/download - Download recording file
   */
  async downloadRecording(req: any, res: Response) {
    const recording = await (models as any).MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canAccess = await recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    recording.analytics.downloadCount += 1;
    await recording.save();

    const signedDownloadUrl = await generateSignedUrl(
      recording.recording.storagePath,
      { expiresIn: 3600 }
    );

    return res.redirect(signedDownloadUrl);
  }
}
