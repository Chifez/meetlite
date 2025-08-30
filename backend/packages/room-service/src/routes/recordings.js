import express from 'express';
import multer from 'multer';
import { models } from '../index.js';
import {
  uploadVideoFile,
  checkCloudinaryConfig,
  extractAudioFromVideo,
} from '../services/cloudinaryService.js';
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
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No recording file provided',
      });
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
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    // Verify meeting exists and user has access (if meetingId provided)
    if (meetingId) {
      const meeting = await models.Meeting.findById(meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found',
        });
      }

      // Check if user has access to the meeting
      const hasAccess =
        meeting.host.userId.toString() === req.user.userId ||
        meeting.participants.some((p) => p.email === req.user.email);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this meeting',
        });
      }
    }

    // Check Cloudinary configuration
    if (!checkCloudinaryConfig()) {
      return res.status(500).json({
        success: false,
        message: 'File storage service not configured properly',
      });
    }

    // Create recording document first
    const recording = new models.MeetingRecording({
      meetingId: meetingId || null,
      organizationId: req.user.organizationId || null,
      title: title.trim(),
      description: description?.trim(),
      recording: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        format: req.file.mimetype.split('/')[1],
        storageProvider: 'cloudinary',
        // These will be set after upload to Cloudinary
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

    await recording.save();

    try {
      // Upload to Cloudinary
      const uploadResult = await uploadVideoFile(req.file.buffer, {
        fileName: req.file.originalname,
        organizationId: req.user.organizationId,
        recordingId: recording._id.toString(),
        fileFormat: req.file.mimetype.split('/')[1],
      });

      // Update recording with Cloudinary URLs
      recording.recording.storagePath = uploadResult.storagePath;
      recording.recording.downloadUrl = uploadResult.downloadUrl;
      recording.recording.streamingUrl = uploadResult.streamingUrl;
      recording.recording.thumbnailUrl = uploadResult.thumbnailUrl;
      recording.recording.duration = uploadResult.duration;
      recording.recording.quality = uploadResult.quality;
      recording.processingStatus = 'completed';

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
            duration: recording.recording.duration,
            quality: recording.recording.quality,
            format: recording.recording.format,
          },
          createdAt: recording.createdAt,
        },
        message: 'Recording uploaded and processed successfully.',
      });
    } catch (uploadError) {
      console.error('Cloudinary upload failed:', uploadError);

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
    };

    const recordings = await models.MeetingRecording.findByOrganization(
      req.user.organizationId,
      options
    );

    const total = await models.MeetingRecording.countDocuments({
      organizationId: req.user.organizationId,
      isArchived: false,
    });

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

    // Archive instead of hard delete
    recording.isArchived = true;
    recording.archiveDate = new Date();
    await recording.save();

    // TODO: Clean up files from Cloudinary

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

    // TODO: Implement actual file download from Cloudinary
    // For now, return the download URL
    if (recording.recording.downloadUrl) {
      res.redirect(recording.recording.downloadUrl);
    } else {
      res.status(404).json({
        success: false,
        message: 'Recording file not available for download',
      });
    }
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
          audioUrl = audioResult.audioUrl;
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
