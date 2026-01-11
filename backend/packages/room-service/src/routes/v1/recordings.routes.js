import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { verifyToken } from '../../middleware/auth.js';
import { requireTeamAccess } from '../../middleware/team-access.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import { RecordingController } from '../../controllers/recording.controller.js';
import { AppError } from '@minimeet/shared';

const router = express.Router();
const recordingController = new RecordingController();

// Apply authentication to all routes
router.use(verifyToken);

// Configure multer for file uploads with disk storage for better progress tracking
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  },
});

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
 * Multer error handler middleware
 */
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 500MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
    });
  }
  if (err) {
    // Handle fileFilter errors
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
    });
  }
  next();
};

/**
 * @route   POST /api/v1/recordings
 * @desc    Upload a new recording
 * @access  Private
 * Note: Upload handler needs special handling for multer file size errors
 */
router.post(
  '/',
  upload.single('recording'),
  handleMulterError,
  asyncHandler(recordingController.uploadRecording.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings
 * @desc    Get recordings list
 * @access  Private
 */
router.get(
  '/',
  requireTeamAccess,
  asyncHandler(recordingController.getRecordings.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings/:id
 * @desc    Get recording details
 * @access  Private
 */
router.get(
  '/:id',
  requireTeamAccess,
  asyncHandler(recordingController.getRecording.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings/:id/stream
 * @desc    Get fresh signed URL for video streaming
 * @access  Private
 */
router.get(
  '/:id/stream',
  asyncHandler(recordingController.getStreamingUrl.bind(recordingController))
);

/**
 * @route   PUT /api/v1/recordings/:id
 * @desc    Update recording metadata
 * @access  Private
 */
router.put(
  '/:id',
  asyncHandler(recordingController.updateRecording.bind(recordingController))
);

/**
 * @route   DELETE /api/v1/recordings/:id
 * @desc    Delete recording
 * @access  Private
 */
router.delete(
  '/:id',
  asyncHandler(recordingController.deleteRecording.bind(recordingController))
);

/**
 * @route   POST /api/v1/recordings/:id/process
 * @desc    Start AI processing (transcript/summary)
 * @access  Private
 */
router.post(
  '/:id/process',
  asyncHandler(recordingController.processRecording.bind(recordingController))
);

/**
 * @route   POST /api/v1/recordings/:id/share
 * @desc    Generate shareable link for recording
 * @access  Private
 */
router.post(
  '/:id/share',
  asyncHandler(recordingController.shareRecording.bind(recordingController))
);

/**
 * @route   POST /api/v1/recordings/:id/archive
 * @desc    Archive recording
 * @access  Private
 */
router.post(
  '/:id/archive',
  asyncHandler(recordingController.archiveRecording.bind(recordingController))
);

/**
 * @route   POST /api/v1/recordings/:id/unarchive
 * @desc    Unarchive recording
 * @access  Private
 */
router.post(
  '/:id/unarchive',
  asyncHandler(recordingController.unarchiveRecording.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings/:id/status
 * @desc    Get processing status
 * @access  Private
 */
router.get(
  '/:id/status',
  asyncHandler(recordingController.getRecordingStatus.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings/stats
 * @desc    Get organization recording statistics
 * @access  Private
 */
router.get(
  '/stats',
  asyncHandler(recordingController.getRecordingStats.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings/:id/download
 * @desc    Download recording file
 * @access  Private
 */
router.get(
  '/:id/download',
  asyncHandler(recordingController.downloadRecording.bind(recordingController))
);

export default router;
