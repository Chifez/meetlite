import fs from 'fs/promises';
import { models } from '../index.js';
import { AppError, ResponseHelpers } from '@minimeet/shared';
import {
  uploadVideoFile,
  checkR2Config,
  extractAudioFromVideo,
  generateSignedUrl,
} from '../services/cloudflare-r2.service.js';
import {
  transcribeRecording,
  generateRecordingSummary,
} from '../services/ai.service.js';

/**
 * Background function to process recording AI (transcript/summary)
 * @param {Object} recording - Recording document
 * @param {string} type - Processing type
 * @param {string} processingId - Unique processing ID
 */
async function processRecordingAI(recording, type, processingId) {
  try {
    let transcriptData = null;

    // Step 1: Generate transcript if needed
    if (type === 'transcript' || type === 'both') {
      try {
        // Extract audio from video if needed
        let audioUrl = recording.recording.streamingUrl;

        // If it's a video, we might need to extract audio
        if (
          recording.recording.format !== 'mp3' &&
          recording.recording.format !== 'wav'
        ) {
          const audioResult = await extractAudioFromVideo(
            recording.recording.storagePath
          );

          // For now, use the original video URL since audio extraction is not implemented
          if (audioResult.success && audioResult.audioUrl) {
            audioUrl = audioResult.audioUrl;
          } else {
            // The transcription service should handle video files directly
          }
        }

        transcriptData = await transcribeRecording(audioUrl);

        // Update recording with transcript
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
        // Use existing transcript or the one we just generated
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

        // Update recording with summary
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

    // TODO: Send notification email or webhook about completion
  } catch (error) {
    console.error('AI processing failed:', error);

    // Update status to failed
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
   * Note: This handler needs special handling for multer file upload errors
   */
  async uploadRecording(req, res) {
    // Handle multer-specific errors before processing
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

    // Validation
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

    // Verify meeting exists and user has access (if meetingId provided)
    if (meetingId) {
      const meeting = await models.Meeting.findById(meetingId);
      if (!meeting) {
        throw AppError.notFound('Meeting');
      }

      // Check if user has access to the meeting
      const hasAccess =
        meeting.host.userId.toString() === req.user.userId ||
        meeting.participants.some((p) => p.email === req.user.email);

      if (!hasAccess) {
        throw AppError.forbidden('Access denied to this meeting');
      }
    }

    // Check R2 configuration
    if (!checkR2Config()) {
      throw AppError.internal('File storage service not configured properly');
    }

    // Create recording document first
    const recording = new models.MeetingRecording({
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
        // These will be set after upload to R2
        storagePath: null,
        downloadUrl: null,
        streamingUrl: null,
        thumbnailUrl: null,
      },
      visibility,
      tags: Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim())
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
    } catch (saveError) {
      console.error('Database save error:', saveError);
      throw AppError.internal(`Failed to save recording: ${saveError.message}`);
    }

    // Track file path for cleanup
    let tempFilePath = req.file.path;

    try {
      // Read file from disk into buffer for R2 upload
      const fileBuffer = await fs.readFile(tempFilePath);

      // Upload to Cloudflare R2
      const uploadResult = await uploadVideoFile(fileBuffer, {
        fileName: req.file.originalname,
        organizationId: req.user.organizationId,
        recordingId: recording._id.toString(),
        fileFormat: req.file.mimetype.split('/')[1],
      });

      // Update recording with R2 URLs
      recording.recording.storagePath = uploadResult.key;
      recording.recording.downloadUrl = uploadResult.downloadUrl;
      recording.recording.streamingUrl = uploadResult.streamingUrl;
      recording.recording.thumbnailUrl = uploadResult.thumbnailUrl;
      // Set duration and quality from upload result (now from FFmpeg processing)
      recording.recording.duration = uploadResult.duration || 0;
      recording.recording.quality = uploadResult.quality || 'unknown';
      recording.processingStatus = 'completed';

      await recording.save();

      // Generate signed URLs for secure access
      const signedStreamingUrl = await generateSignedUrl(uploadResult.key, {
        expiresIn: 3600,
      });
      const signedDownloadUrl = await generateSignedUrl(uploadResult.key, {
        expiresIn: 3600,
      });

      // Update with signed URLs
      recording.recording.streamingUrl = signedStreamingUrl;
      recording.recording.downloadUrl = signedDownloadUrl;
      await recording.save();

      // Clean up temporary file after successful upload
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // Failed to delete temporary file - non-critical
      }

      // TODO: Start AI processing (transcript/summary)

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
    } catch (uploadError) {
      console.error('R2 upload failed:', uploadError);

      // Clean up temporary file on error
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          // Failed to delete temporary file after error
        }
      }

      // Update recording status to failed
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
  async getRecordings(req, res) {
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

    // Organization is required for accessing recordings
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

    const recordings = await models.MeetingRecording.findByOrganization(
      req.user.organizationId,
      options
    );

    const countQuery = { organizationId: req.user.organizationId };
    if (teamId) {
      countQuery.teamId = teamId;
    }
    if (isArchived !== undefined) {
      countQuery.isArchived = isArchived === 'true' ? true : false;
    } else {
      countQuery.isArchived = false; // Default to non-archived
    }

    const total = await models.MeetingRecording.countDocuments(countQuery);

    // Return in format expected by frontend: { success: true, recordings: [...], pagination: {...} }
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
  async getRecording(req, res) {
    const recording = await models.MeetingRecording.findById(req.params.id)
      .populate('meetingId', 'title scheduledTime')
      .populate('participants.userId', 'name email')
      .lean();

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    // Transform participants to flatten the populated user data
    if (recording.participants) {
      recording.participants = recording.participants.map((participant) => {
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

    // Check access permissions
    const recordingDoc = await models.MeetingRecording.findById(req.params.id);
    const canAccess = await recordingDoc.canAccess(
      req.user.userId,
      req.user.role
    );
    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    // Increment view count
    await models.MeetingRecording.findByIdAndUpdate(req.params.id, {
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
  async getStreamingUrl(req, res) {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    // Check access permissions
    const canAccess = await recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    // Generate fresh signed URLs
    const streamingUrl = await generateSignedUrl(
      recording.recording.storagePath,
      3600 // 1 hour expiry
    );

    const thumbnailUrl = recording.recording.thumbnailPath
      ? await generateSignedUrl(recording.recording.thumbnailPath, 3600)
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
  async updateRecording(req, res) {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    // Check if user can edit (host or organization owner/admin)
    const canEdit =
      recording.participants.some(
        (p) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === 'owner' ||
      req.user.role === 'admin';

    if (!canEdit) {
      throw AppError.forbidden('Permission denied to edit this recording');
    }

    // Update allowed fields
    const { title, description, tags, visibility } = req.body;

    if (title) recording.title = title.trim();
    if (description !== undefined) recording.description = description?.trim();
    if (tags)
      recording.tags = Array.isArray(tags)
        ? tags
        : tags.split(',').map((t) => t.trim());
    if (visibility) recording.visibility = visibility;

    await recording.save();

    return ResponseHelpers.ok(res, recording, 'Recording updated successfully');
  }

  /**
   * DELETE /recordings/:id - Delete recording
   */
  async deleteRecording(req, res) {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    // Check if user can delete (host or organization owner/admin)
    const canDelete =
      recording.participants.some(
        (p) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === 'owner' ||
      req.user.role === 'admin';

    if (!canDelete) {
      throw AppError.forbidden('Permission denied to delete this recording');
    }

    // Actually delete the recording and clean up files
    const { deleteFile } = await import('../services/cloudflare-r2.service.js');

    // Delete files from R2
    if (recording.recording.storagePath) {
      try {
        await deleteFile(recording.recording.storagePath);
      } catch (error) {
        // Failed to delete file from R2 - log but continue
        console.error('Failed to delete file from R2:', error);
      }
    }

    // Delete thumbnail if it exists
    if (recording.recording.thumbnailUrl) {
      try {
        const thumbnailPath = recording.recording.thumbnailUrl
          .split('/')
          .slice(-2)
          .join('/');
        await deleteFile(thumbnailPath);
      } catch (error) {
        // Failed to delete thumbnail from R2 - log but continue
        console.error('Failed to delete thumbnail from R2:', error);
      }
    }

    // Delete the recording from database
    await models.MeetingRecording.findByIdAndDelete(req.params.id);

    return ResponseHelpers.ok(res, null, 'Recording deleted successfully');
  }

  /**
   * POST /recordings/:id/process - Start AI processing (transcript/summary)
   */
  async processRecording(req, res) {
    const { type = 'both' } = req.body; // 'transcript', 'summary', or 'both'

    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    // Check access permissions
    const canAccess = await recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    // Validate processing type
    const validTypes = ['transcript', 'summary', 'both'];
    if (!validTypes.includes(type)) {
      throw AppError.validation(
        'Invalid processing type. Must be: transcript, summary, or both'
      );
    }

    // Check if recording file is available
    if (!recording.recording.streamingUrl) {
      throw AppError.validation('Recording file not available for processing');
    }

    const processingId = `${recording._id}_${type}_${Date.now()}`;

    // Update processing status immediately
    if (type === 'transcript' || type === 'both') {
      recording.transcript.status = 'processing';
    }
    if (type === 'summary' || type === 'both') {
      recording.aiSummary.status = 'processing';
    }

    await recording.save();

    // Start background processing (don't await - process in background)
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
  async shareRecording(req, res) {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    // Check access permissions
    const canAccess = await recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    // Generate a shareable token (you might want to store this in DB)
    const shareToken = Buffer.from(`${recording._id}:${Date.now()}`).toString(
      'base64'
    );

    // Generate signed URL with longer expiry for sharing (24 hours)
    const shareableUrl = await generateSignedUrl(
      recording.recording.storagePath,
      86400 // 24 hours expiry
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
  async archiveRecording(req, res) {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    // Check if user can archive (host or organization owner/admin)
    const canArchive =
      recording.participants.some(
        (p) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === 'owner' ||
      req.user.role === 'admin';

    if (!canArchive) {
      throw AppError.forbidden('Permission denied to archive this recording');
    }

    // Archive the recording
    recording.isArchived = true;
    recording.archiveDate = new Date();
    await recording.save();

    return ResponseHelpers.ok(res, null, 'Recording archived successfully');
  }

  /**
   * POST /recordings/:id/unarchive - Unarchive recording
   */
  async unarchiveRecording(req, res) {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    // Check if user can unarchive (host or organization owner/admin)
    const canUnarchive =
      recording.participants.some(
        (p) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) ||
      req.user.role === 'owner' ||
      req.user.role === 'admin';

    if (!canUnarchive) {
      throw AppError.forbidden(
        'Permission denied to unarchive this recording'
      );
    }

    // Unarchive the recording
    recording.isArchived = false;
    recording.archiveDate = undefined;
    await recording.save();

    return ResponseHelpers.ok(res, null, 'Recording unarchived successfully');
  }

  /**
   * GET /recordings/:id/status - Get processing status
   */
  async getRecordingStatus(req, res) {
    const recording = await models.MeetingRecording.findById(req.params.id)
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
  async getRecordingStats(req, res) {
    if (!req.user.organizationId) {
      throw AppError.validation(
        'Organization membership required for statistics'
      );
    }

    const stats = await models.MeetingRecording.getStorageStats(
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
   * Note: Uses res.redirect() which is fine
   */
  async downloadRecording(req, res) {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      throw AppError.notFound('Recording');
    }

    // Check access permissions
    const canAccess = await recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      throw AppError.forbidden('Access denied to this recording');
    }

    // Increment download count
    recording.analytics.downloadCount += 1;
    await recording.save();

    // Generate fresh signed URL for download
    const signedDownloadUrl = await generateSignedUrl(
      recording.recording.storagePath,
      {
        expiresIn: 3600, // 1 hour
      }
    );

    return res.redirect(signedDownloadUrl);
  }
}

