import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@minimeet/shared';
import { AppError, ResponseHelpers } from '@minimeet/shared';
import { VideoProcessingQueue } from '@minimeet/shared';
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
import { WORKSPACE_ROLES } from '@minimeet/shared';


// Singleton queue instance – lazily initialized
let videoQueue: VideoProcessingQueue | null = null;
function getVideoQueue(): VideoProcessingQueue {
  if (!videoQueue) {
    videoQueue = new VideoProcessingQueue();
  }
  return videoQueue;
}


/**
 * Background function to process recording AI (transcript/summary)
 */
async function processRecordingAI(recording: any, type: string, processingId: string) {
  try {
    let transcriptData: any = null;
    const updateData: any = {};

    if (type === 'transcript' || type === 'both') {
      try {
        let audioUrl = recording.streamingUrl;

        if (recording.format !== 'mp3' && recording.format !== 'wav') {
          const audioResult = await extractAudioFromVideo(recording.storagePath);
          if (audioResult.success && audioResult.audioUrl) {
            audioUrl = audioResult.audioUrl;
          }
        }

        transcriptData = await transcribeRecording(audioUrl);

        updateData.transcriptText = transcriptData.text;
        updateData.transcriptLanguage = transcriptData.language;
        updateData.transcriptStatus = 'completed';
        updateData.transcriptProvider = 'openai';

        if (transcriptData.segments && transcriptData.segments.length > 0) {
          updateData.transcriptSegments = {
            create: transcriptData.segments.map((seg: any) => ({
              start: seg.start,
              end: seg.end,
              text: seg.text,
              speakerId: seg.speaker || null,
            }))
          };
        }
      } catch (transcriptError) {
        console.error('Transcript processing failed:', transcriptError);
        updateData.transcriptStatus = 'failed';
      }
    }

    if (type === 'summary' || type === 'both') {
      try {
        const transcriptText = transcriptData?.text || recording.transcriptText;

        if (!transcriptText) {
          throw new Error('No transcript available for summary generation');
        }

        const summaryData = await generateRecordingSummary(transcriptText, {
          meetingContext: recording.description || recording.title,
          participantCount: recording.participants ? recording.participants.length : 0,
          duration: recording.duration,
        });

        updateData.summaryText = summaryData.summary;
        updateData.summaryKeyPoints = summaryData.keyPoints;
        updateData.summaryTopics = summaryData.topics;
        updateData.summarySentiment = summaryData.sentiment;
        updateData.summaryStatus = 'completed';
        updateData.summaryProvider = 'openai';

        if (summaryData.actionItems && summaryData.actionItems.length > 0) {
          updateData.actionItems = {
            create: summaryData.actionItems.map((item: any) => ({
              description: item.description,
              assigneeId: item.assignee || null,
              dueDate: item.dueDate ? new Date(item.dueDate) : null,
              status: 'pending'
            }))
          };
        }
      } catch (summaryError) {
        console.error('Summary processing failed:', summaryError);
        updateData.summaryStatus = 'failed';
      }
    }

    const transcriptDone = updateData.transcriptStatus === 'completed' || recording.transcriptStatus === 'completed' || type === 'summary';
    const summaryDone = updateData.summaryStatus === 'completed' || recording.summaryStatus === 'completed' || type === 'transcript';

    if (transcriptDone && summaryDone) {
      updateData.processingStatus = 'completed';
    } else if (updateData.transcriptStatus === 'failed' || updateData.summaryStatus === 'failed') {
      updateData.processingStatus = 'failed';
    }

    await prisma.meetingRecording.update({
      where: { id: recording.id },
      data: updateData
    });
  } catch (error) {
    console.error('AI processing failed:', error);

    try {
      const failedUpdate: any = { processingStatus: 'failed' };
      if (type === 'transcript' || type === 'both') {
        failedUpdate.transcriptStatus = 'failed';
      }
      if (type === 'summary' || type === 'both') {
        failedUpdate.summaryStatus = 'failed';
      }
      await prisma.meetingRecording.update({
        where: { id: recording.id },
        data: failedUpdate
      });
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
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: { participants: true }
      });
      if (!meeting) {
        throw AppError.notFound('Meeting');
      }

      const hasAccess =
        meeting.createdBy === req.user.userId ||
        meeting.participants.some((p: any) => p.userId === req.user.userId);

      if (!hasAccess) {
        throw AppError.forbidden('Access denied to this meeting');
      }
    }

    if (!checkR2Config()) {
      throw AppError.internal('File storage service not configured properly');
    }

    let recording: any;

    try {
      recording = await prisma.meetingRecording.create({
        data: {
          meetingId: meetingId || null,
          organizationId: req.user.organizationId || null,
          teamId: req.body.teamId || null,
          title: title.trim(),
          description: description?.trim(),
          fileName: req.file.originalname,
          fileSize: req.file.size,
          format: req.file.mimetype.split('/')[1],
          storageProvider: 'r2',
          visibility,
          tags: Array.isArray(tags)
            ? tags
            : typeof tags === 'string'
            ? tags.split(',').map((t: string) => t.trim())
            : [],
          processingStatus: 'uploading',
          participants: {
            create: [{
              userId: req.user.userId,
              role: 'host',
              joinTime: new Date()
            }]
          }
        }
      });
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
        recordingId: recording.id,
        fileFormat: req.file.mimetype.split('/')[1],
      });

      const signedStreamingUrl = await generateSignedUrl(uploadResult.key, {
        expiresIn: 3600,
      });
      const signedDownloadUrl = await generateSignedUrl(uploadResult.key, {
        expiresIn: 3600,
      });

      recording = await prisma.meetingRecording.update({
        where: { id: recording.id },
        data: {
          storagePath: uploadResult.key,
          downloadUrl: signedDownloadUrl,
          streamingUrl: signedStreamingUrl,
          thumbnailUrl: uploadResult.thumbnailUrl,
          duration: uploadResult.duration || 0,
          quality: uploadResult.quality || 'unknown',
          processingStatus: 'completed'
        }
      });

      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {}

      return res.status(201).json({
        success: true,
        recording: {
          id: recording.id,
          title: recording.title,
          description: recording.description,
          processingStatus: recording.processingStatus,
          recording: {
            thumbnailUrl: recording.thumbnailUrl,
            duration: recording.duration || 0,
            quality: recording.quality || 'unknown',
            format: recording.format,
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

      await prisma.meetingRecording.update({
        where: { id: recording.id },
        data: { processingStatus: 'failed' }
      });

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

    // Build query – supports both org-scoped and personal (no org) recordings
    const orgId = req.user.organizationId || null;
    const query: any = {};

    if (orgId) {
      // Org workspace: filter by organizationId
      query.organizationId = orgId;
    } else {
      // Personal workspace: recordings with no org where the user is a participant
      query.organizationId = null;
      query.participants = { some: { userId: req.user.userId } };
    }

    if (teamId) {
      query.teamId = teamId;
    }
    if (isArchived !== undefined) {
      query.isArchived = isArchived === 'true';
    } else {
      query.isArchived = false;
    }
    if (status) query.processingStatus = status;

    if (tags && tags.length > 0) {
      // Tags is a Json field, simple filtering might require raw query or string contains in Prisma.
      // We'll skip complex array filtering for Json in this demo, or just use string_contains.
      query.tags = { string_contains: tags.split(',')[0] };
    }

    if (search) {
      query.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }


    const nativeRecordings = await prisma.meetingRecording.findMany({
      where: query,
      include: {
        meeting: { select: { title: true, scheduledTime: true } },
        participants: { include: { user: { select: { name: true, email: true } } } }
      },
      orderBy: { [sortBy as string]: sortOrder === 'desc' ? 'desc' : 'asc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    });

    const recordings = nativeRecordings.map((recording: any) => {
      if (recording.participants) {
        recording.participants = recording.participants.map((participant: any) => {
          return {
            ...participant,
            name: participant.user?.name || '',
            email: participant.user?.email || '',
            userId: participant.userId,
          };
        });
      }
      return recording;
    });

    const total = await prisma.meetingRecording.count({ where: query });

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
    let recording: any = await prisma.meetingRecording.findUnique({
      where: { id: req.params.id },
      include: {
        meeting: { select: { title: true, scheduledTime: true } },
        participants: { include: { user: { select: { name: true, email: true } } } },
        actionItems: true,
        transcriptSegments: true,
      }
    });

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    if (recording.participants) {
      recording.participants = recording.participants.map((participant: any) => {
        return {
          ...participant,
          name: participant.user?.name || '',
          email: participant.user?.email || '',
          userId: participant.userId,
        };
      });
    }

    // Access check
    let canAccess = false;
    if (req.user.role === WORKSPACE_ROLES.ADMIN || req.user.role === WORKSPACE_ROLES.OWNER) {
      canAccess = true;
    } else if (recording.participants.some((p: any) => p.userId === req.user.userId)) {
      canAccess = true;
    }

    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    await prisma.meetingRecording.update({
      where: { id: req.params.id },
      data: {
        viewCount: { increment: 1 },
        retentionLastAccess: new Date(),
      }
    });

    return res.json({
      success: true,
      recording,
    });
  }

  async getStreamingUrl(req: any, res: Response) {
    const recording = await prisma.meetingRecording.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    let canAccess = false;
    if (req.user.role === WORKSPACE_ROLES.ADMIN || req.user.role === WORKSPACE_ROLES.OWNER) {
      canAccess = true;
    } else if (recording.participants.some((p: any) => p.userId === req.user.userId)) {
      canAccess = true;
    }

    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    const streamingUrl = await generateSignedUrl(
      recording.storagePath as string,
      { expiresIn: 3600 }
    );

    const thumbnailUrl = recording.thumbnailUrl
      ? await generateSignedUrl(recording.thumbnailUrl, { expiresIn: 3600 })
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
    const recording = await prisma.meetingRecording.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canEdit =
      recording.participants.some(
        (p: any) => p.userId === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === WORKSPACE_ROLES.OWNER ||
      req.user.role === WORKSPACE_ROLES.ADMIN;

    if (!canEdit) {
      throw AppError.forbidden('Permission denied to edit this recording');
    }

    const { title, description, tags, visibility } = req.body;
    const updateData: any = {};

    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (tags) {
      updateData.tags = Array.isArray(tags)
        ? tags
        : tags.split(',').map((t: string) => t.trim());
    }
    if (visibility) updateData.visibility = visibility;

    const updated = await prisma.meetingRecording.update({
      where: { id: req.params.id },
      data: updateData
    });

    return ResponseHelpers.ok(res, updated, 'Recording updated successfully');
  }

  /**
   * DELETE /recordings/:id - Delete recording
   */
  async deleteRecording(req: any, res: Response) {
    const recording = await prisma.meetingRecording.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canDelete =
      recording.participants.some(
        (p: any) => p.userId === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === WORKSPACE_ROLES.OWNER ||
      req.user.role === WORKSPACE_ROLES.ADMIN;

    if (!canDelete) {
      throw AppError.forbidden('Permission denied to delete this recording');
    }

    if (recording.storagePath) {
      try {
        await deleteFile(recording.storagePath);
      } catch (error) {
        console.error('Failed to delete file from R2:', error);
      }
    }

    if (recording.thumbnailUrl) {
      try {
        const thumbnailPath = recording.thumbnailUrl
          .split('/')
          .slice(-2)
          .join('/');
        await deleteFile(thumbnailPath);
      } catch (error) {
        console.error('Failed to delete thumbnail from R2:', error);
      }
    }

    await prisma.meetingRecording.delete({ where: { id: req.params.id } });

    return ResponseHelpers.ok(res, null, 'Recording deleted successfully');
  }

  /**
   * POST /recordings/:id/process - Start AI processing (transcript/summary)
   */
  async processRecording(req: any, res: Response) {
    const { type = 'both' } = req.body;

    const recording = await prisma.meetingRecording.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    let canAccess = false;
    if (req.user.role === WORKSPACE_ROLES.ADMIN || req.user.role === WORKSPACE_ROLES.OWNER) {
      canAccess = true;
    } else if (recording.participants.some((p: any) => p.userId === req.user.userId)) {
      canAccess = true;
    }

    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    const validTypes = ['transcript', 'summary', 'both'];
    if (!validTypes.includes(type)) {
      throw AppError.validation(
        'Invalid processing type. Must be: transcript, summary, or both'
      );
    }

    if (!recording.streamingUrl) {
      throw AppError.validation('Recording file not available for processing');
    }

    const processingId = `${recording.id}_${type}_${Date.now()}`;

    const updateData: any = {};
    if (type === 'transcript' || type === 'both') {
      updateData.transcriptStatus = 'processing';
    }
    if (type === 'summary' || type === 'both') {
      updateData.summaryStatus = 'processing';
    }

    await prisma.meetingRecording.update({
      where: { id: req.params.id },
      data: updateData
    });

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
    const recording = await prisma.meetingRecording.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    let canAccess = false;
    if (req.user.role === WORKSPACE_ROLES.ADMIN || req.user.role === WORKSPACE_ROLES.OWNER) {
      canAccess = true;
    } else if (recording.participants.some((p: any) => p.userId === req.user.userId)) {
      canAccess = true;
    }

    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    const shareToken = Buffer.from(`${recording.id}:${Date.now()}`).toString(
      'base64'
    );

    const shareableUrl = await generateSignedUrl(
      recording.storagePath as string,
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
    const recording = await prisma.meetingRecording.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canArchive =
      recording.participants.some(
        (p: any) => p.userId === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === WORKSPACE_ROLES.OWNER ||
      req.user.role === WORKSPACE_ROLES.ADMIN;

    if (!canArchive) {
      throw AppError.forbidden('Permission denied to archive this recording');
    }

    await prisma.meetingRecording.update({
      where: { id: req.params.id },
      data: { isArchived: true, archiveDate: new Date() }
    });

    return ResponseHelpers.ok(res, null, 'Recording archived successfully');
  }

  /**
   * POST /recordings/:id/unarchive - Unarchive recording
   */
  async unarchiveRecording(req: any, res: Response) {
    const recording = await prisma.meetingRecording.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    const canUnarchive =
      recording.participants.some(
        (p: any) => p.userId === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === WORKSPACE_ROLES.OWNER ||
      req.user.role === WORKSPACE_ROLES.ADMIN;

    if (!canUnarchive) {
      throw AppError.forbidden('Permission denied to unarchive this recording');
    }

    await prisma.meetingRecording.update({
      where: { id: req.params.id },
      data: { isArchived: false, archiveDate: null }
    });

    return ResponseHelpers.ok(res, null, 'Recording unarchived successfully');
  }

  /**
   * GET /recordings/:id/status - Get processing status
   */
  async getRecordingStatus(req: any, res: Response) {
    const recording = await prisma.meetingRecording.findUnique({
      where: { id: req.params.id },
      include: { participants: true },
    }) as any;

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    let canAccess = false;
    if (req.user.role === WORKSPACE_ROLES.ADMIN || req.user.role === WORKSPACE_ROLES.OWNER) {
      canAccess = true;
    } else if (recording.participants.some((p: any) => p.userId === req.user.userId)) {
      canAccess = true;
    }

    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    return res.json({
      success: true,
      status: {
        overall: recording.processingStatus,
        progress: recording.processingProgress,
        transcript: recording.transcriptStatus,
        summary: recording.summaryStatus,
        isProcessing: recording.processingStatus === 'processing',
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

    const aggregates = await prisma.meetingRecording.aggregate({
      where: { organizationId: req.user.organizationId },
      _sum: { fileSize: true, duration: true },
      _count: { id: true }
    });

    const transcriptsCount = await prisma.meetingRecording.count({
      where: { organizationId: req.user.organizationId, transcriptStatus: 'completed' }
    });

    const summariesCount = await prisma.meetingRecording.count({
      where: { organizationId: req.user.organizationId, summaryStatus: 'completed' }
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

  /**
   * GET /recordings/:id/download - Download recording file
   */
  async downloadRecording(req: any, res: Response) {
    const recording = await prisma.meetingRecording.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    let canAccess = false;
    if (req.user.role === WORKSPACE_ROLES.ADMIN || req.user.role === WORKSPACE_ROLES.OWNER) {
      canAccess = true;
    } else if (recording.participants.some((p: any) => p.userId === req.user.userId)) {
      canAccess = true;
    }

    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    await prisma.meetingRecording.update({
      where: { id: req.params.id },
      data: { downloadCount: { increment: 1 } }
    });

    if (!recording.downloadUrl) {
      throw AppError.notFound('Download URL not found');
    }

    return res.redirect(recording.downloadUrl);
  }

  /**
   * POST /recordings/internal-finalize
   * Internal endpoint called by mediasoup-service to hand off a completed recording file.
   * Validates the internal service secret, creates a MeetingRecording DB record with
   * processingStatus='queued', then enqueues a VideoProcessingQueue job.
   */
  async internalFinalizeRecording(req: any, res: Response) {
    // Internal secret auth
    const secret = req.headers['x-internal-secret'];
    const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;
    if (!expectedSecret) {
      return res.status(500).json({ success: false, message: 'Server misconfiguration: internal secret not set' });
    }
    if (secret !== expectedSecret) {
      return res.status(401).json({ success: false, message: 'Unauthorized internal request' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No recording file provided' });
    }

    const {
      roomId,
      recordingId: sourceRecordingId,
      duration,
      startedBy,
      participants: participantsJson,
    } = req.body;

    // Optionally find meeting linked to room
    let meetingId: string | null = null;
    let organizationId: string | null = null;
    if (roomId) {
      const room = await prisma.room.findUnique({ where: { roomId } });
      if (room) {
        organizationId = (room as any).organizationId || null;
        const meeting = await prisma.meeting.findFirst({ where: { roomId } });
        if (meeting) meetingId = meeting.id;
      }
    }

    // Build participant list from host userId
    let participantList: { userId: string; role: string; joinTime: Date }[] = [];
    if (startedBy) {
      participantList.push({ userId: startedBy, role: 'host', joinTime: new Date() });
    }
    try {
      const parsed = JSON.parse(participantsJson || '[]');
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          if (p && p !== startedBy) {
            participantList.push({ userId: String(p), role: 'participant', joinTime: new Date() });
          }
        }
      }
    } catch (_) {}

    // Create the DB record in 'queued' state
    const recording = await prisma.meetingRecording.create({
      data: {
        meetingId: meetingId || null,
        organizationId: organizationId || null,
        title: `Meeting Recording – ${new Date().toLocaleString()}`,
        fileName: req.file.originalname || req.file.filename,
        fileSize: req.file.size,
        format: 'webm',
        storageProvider: 'r2',
        visibility: 'participants',
        duration: parseInt(duration || '0', 10),
        processingStatus: 'queued',
        transcriptStatus: 'pending',
        summaryStatus: 'pending',
        participants: {
          create: participantList,
        },
      },
    });

    // Enqueue processing job (the worker will upload to R2, then run AI)
    const tempFilePath = req.file.path; // multer saved it here
    await getVideoQueue().addVideoJob('process', {
      recordingId: recording.id,
      tempFilePath,
      fileName: req.file.originalname || req.file.filename,
      organizationId,
      duration: parseInt(duration || '0', 10),
      startedBy,
      roomId,
      sourceRecordingId,
    });

    return res.status(202).json({
      success: true,
      message: 'Recording accepted and queued for processing',
      recordingId: recording.id,
    });
  }
}


export default RecordingController;
