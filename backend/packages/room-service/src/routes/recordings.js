import express from 'express';
import multer from 'multer';
import { models } from '../index.js';
import { AppError } from '@minimeet/shared-models';
import {
  uploadVideoFile,
  checkR2Config,
  extractAudioFromVideo,
} from '../services/cloudflareR2Service.js';
import {
  transcribeRecording,
  generateRecordingSummary,
  analyzeRecordingSpeakers,
} from '../services/aiService.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only video and audio files are allowed'), false);
    }
  },
});

/**
 * @route   POST /api/recordings
 * @desc    Upload a new recording
 * @access  Private
 */
router.post('/', upload.single('recording'), async (req, res) => {
  try {
    console.log('Upload request received:', {
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      user: req.user,
      body: req.body,
    });

    if (!req.file) {
      throw new AppError('FILE_6001', 'No recording file provided');
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
      throw new AppError('SYSTEM_9007', 'Title is required');
    }

    if (!req.user.organizationId) {
      throw new AppError(
        'USER_2001',
        'User must belong to an organization to upload recordings'
      );
    }

    if (!req.user.userId) {
      throw new AppError('AUTH_1001', 'Invalid user token - missing userId');
    }

    // Verify meeting exists and user has access (if meetingId provided)
    if (meetingId) {
      const meeting = await models.Meeting.findById(meetingId);
      if (!meeting) {
        throw new AppError('MEETING_4001', 'Meeting not found');
      }

      // Check if user has access to the meeting
      const hasAccess =
        meeting.host.userId.toString() === req.user.userId ||
        meeting.participants.some((p) => p.email === req.user.email);

      if (!hasAccess) {
        throw new AppError('AUTH_1004', 'Access denied to this meeting');
      }
    }

    // Check R2 configuration
    if (!checkR2Config()) {
      throw new AppError(
        'FILE_6005',
        'File storage service not configured properly'
      );
    }

    // Create recording document first
    console.log('Creating recording document with:', {
      meetingId: meetingId || null,
      organizationId: req.user.organizationId || null,
      title: title.trim(),
      userId: req.user.userId,
    });

    const recording = new models.MeetingRecording({
      meetingId: meetingId || null,
      organizationId: req.user.organizationId || null,
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

    console.log('Saving recording to database...');
    try {
      await recording.save();
      console.log('Recording saved successfully with ID:', recording._id);
    } catch (saveError) {
      console.error('Database save error:', saveError);
      throw new AppError(
        'SYSTEM_9006',
        `Failed to save recording: ${saveError.message}`
      );
    }

    try {
      // Upload to Cloudflare R2
      const uploadResult = await uploadVideoFile(req.file.buffer, {
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
      const { generateSignedUrl } = await import(
        '../services/cloudflareR2Service.js'
      );
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

      // TODO: Start AI processing (transcript/summary)

      res.status(201).json({
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

      // Update recording status to failed
      recording.processingStatus = 'failed';
      await recording.save();

      res.status(500).json({
        success: false,
        message: 'Failed to upload recording to storage',
        error: uploadError.message,
      });
    }
  } catch (error) {
    console.error('Error uploading recording:', error);

    // Handle specific multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 500MB.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload recording',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/recordings
 * @desc    Get recordings list
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      tags,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isArchived,
    } = req.query;

    // Organization is required for accessing recordings
    if (!req.user.organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization membership required to access recordings',
      });
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
    };

    const recordings = await models.MeetingRecording.findByOrganization(
      req.user.organizationId,
      options
    );

    const countQuery = { organizationId: req.user.organizationId };
    if (isArchived !== undefined) {
      countQuery.isArchived = isArchived === 'true' ? true : false;
    } else {
      countQuery.isArchived = false; // Default to non-archived
    }

    const total = await models.MeetingRecording.countDocuments(countQuery);

    res.json({
      success: true,
      recordings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recordings',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/recordings/:id
 * @desc    Get recording details
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const recording = await models.MeetingRecording.findById(req.params.id)
      .populate('meetingId', 'title scheduledTime')
      .populate('participants.userId', 'name email');

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    // Check access permissions
    const canAccess = recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this recording',
      });
    }

    // Increment view count
    await recording.incrementViewCount();

    res.json({
      success: true,
      recording,
    });
  } catch (error) {
    console.error('Error fetching recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recording',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/recordings/:id
 * @desc    Update recording metadata
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    // Check if user can edit (host or organization owner)
    const canEdit =
      recording.participants.some(
        (p) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) || req.user.role === 'owner';

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied to edit this recording',
      });
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

    res.json({
      success: true,
      recording,
      message: 'Recording updated successfully',
    });
  } catch (error) {
    console.error('Error updating recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update recording',
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/recordings/:id
 * @desc    Delete recording
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    // Check if user can delete (host or organization owner)
    const canDelete =
      recording.participants.some(
        (p) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) || req.user.role === 'owner';

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied to delete this recording',
      });
    }

    // Actually delete the recording and clean up files
    const { deleteFile } = await import('../services/cloudflareR2Service.js');

    // Delete files from R2
    if (recording.recording.storagePath) {
      try {
        await deleteFile(recording.recording.storagePath);
        console.log('Deleted file from R2:', recording.recording.storagePath);
      } catch (error) {
        console.warn('Failed to delete file from R2:', error.message);
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
        console.log('Deleted thumbnail from R2:', thumbnailPath);
      } catch (error) {
        console.warn('Failed to delete thumbnail from R2:', error.message);
      }
    }

    // Delete the recording from database
    await models.MeetingRecording.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Recording deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete recording',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/recordings/:id/process
 * @desc    Start AI processing (transcript/summary)
 * @access  Private
 */
router.post('/:id/process', async (req, res) => {
  try {
    const { type = 'both' } = req.body; // 'transcript', 'summary', or 'both'

    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    // Check access permissions
    const canAccess = recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this recording',
      });
    }

    // Validate processing type
    const validTypes = ['transcript', 'summary', 'both'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid processing type. Must be: transcript, summary, or both',
      });
    }

    // Check if recording file is available
    if (!recording.recording.streamingUrl) {
      return res.status(400).json({
        success: false,
        message: 'Recording file not available for processing',
      });
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

    res.json({
      success: true,
      message: `${type} processing started`,
      processingId,
    });
  } catch (error) {
    console.error('Error starting processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start processing',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/recordings/:id/archive
 * @desc    Archive recording
 * @access  Private
 */
router.post('/:id/archive', async (req, res) => {
  try {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    // Check if user can archive (host or organization owner)
    const canArchive =
      recording.participants.some(
        (p) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) || req.user.role === 'owner';

    if (!canArchive) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied to archive this recording',
      });
    }

    // Archive the recording
    recording.isArchived = true;
    recording.archiveDate = new Date();
    await recording.save();

    res.json({
      success: true,
      message: 'Recording archived successfully',
    });
  } catch (error) {
    console.error('Error archiving recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive recording',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/recordings/:id/unarchive
 * @desc    Unarchive recording
 * @access  Private
 */
router.post('/:id/unarchive', async (req, res) => {
  try {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    // Check if user can unarchive (host or organization owner)
    const canUnarchive =
      recording.participants.some(
        (p) => p.userId.toString() === req.user.userId && p.role === 'host'
      ) || req.user.role === 'owner';

    if (!canUnarchive) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied to unarchive this recording',
      });
    }

    // Unarchive the recording
    recording.isArchived = false;
    recording.archiveDate = undefined;
    await recording.save();

    res.json({
      success: true,
      message: 'Recording unarchived successfully',
    });
  } catch (error) {
    console.error('Error unarchiving recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unarchive recording',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/recordings/:id/status
 * @desc    Get processing status
 * @access  Private
 */
router.get('/:id/status', async (req, res) => {
  try {
    const recording = await models.MeetingRecording.findById(
      req.params.id
    ).select(
      'processingStatus processingProgress transcript.status aiSummary.status'
    );

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    res.json({
      success: true,
      status: {
        overall: recording.processingStatus,
        progress: recording.processingProgress,
        transcript: recording.transcript.status,
        summary: recording.aiSummary.status,
        isProcessing: recording.isProcessing,
      },
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch status',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/recordings/stats
 * @desc    Get organization recording statistics
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    if (!req.user.organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization membership required for statistics',
      });
    }

    const stats = await models.MeetingRecording.getStorageStats(
      req.user.organizationId
    );

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
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/recordings/:id/download
 * @desc    Download recording file
 * @access  Private
 */
router.get('/:id/download', async (req, res) => {
  try {
    const recording = await models.MeetingRecording.findById(req.params.id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    // Check access permissions
    const canAccess = recording.canAccess(req.user.userId, req.user.role);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this recording',
      });
    }

    // Increment download count
    recording.analytics.downloadCount += 1;
    await recording.save();

    // Generate fresh signed URL for download
    const { generateSignedUrl } = await import(
      '../services/cloudflareR2Service.js'
    );
    const signedDownloadUrl = await generateSignedUrl(
      recording.recording.storagePath,
      {
        expiresIn: 3600, // 1 hour
      }
    );

    res.redirect(signedDownloadUrl);
  } catch (error) {
    console.error('Error downloading recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download recording',
      error: error.message,
    });
  }
});

/**
 * Background function to process recording AI (transcript/summary)
 * @param {Object} recording - Recording document
 * @param {string} type - Processing type
 * @param {string} processingId - Unique processing ID
 */
async function processRecordingAI(recording, type, processingId) {
  try {
    console.log(
      `Starting AI processing for recording ${recording._id}, type: ${type}`
    );

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
          console.log('Extracting audio from video...');
          const audioResult = await extractAudioFromVideo(
            recording.recording.storagePath
          );

          // For now, use the original video URL since audio extraction is not implemented
          if (audioResult.success && audioResult.audioUrl) {
            audioUrl = audioResult.audioUrl;
          } else {
            console.log(
              'Audio extraction not available, using video URL for transcription'
            );
            // The transcription service should handle video files directly
          }
        }

        console.log('Transcribing audio...');
        transcriptData = await transcribeRecording(audioUrl);

        // Update recording with transcript
        recording.transcript.text = transcriptData.text;
        recording.transcript.segments = transcriptData.segments;
        recording.transcript.language = transcriptData.language;
        recording.transcript.status = 'completed';
        recording.transcript.processingProvider = 'openai';

        console.log(`Transcript completed for recording ${recording._id}`);
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

        console.log('Generating AI summary...');
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

        console.log(`Summary completed for recording ${recording._id}`);
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

    console.log(`AI processing completed for recording ${recording._id}`);

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

export default router;
