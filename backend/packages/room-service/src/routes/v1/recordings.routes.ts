import express, { Request, Response, NextFunction } from 'express';
// @ts-ignore
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { verifyToken } from '../../middleware/auth.js';
import { requireTeamAccess } from '../../middleware/team-access.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import { RecordingController } from '../../controllers/recording.controller.js';
import { PLAN_FEATURES } from '@minimeet/shared';
import {
  validatePlanStatus,
  requirePlanFeature,
} from '../../middleware/plan-validation.js';

const router = express.Router();
const recordingController = new RecordingController();

// ─── Shared multer storage (disk) ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: async (req: any, file: any, cb: any) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as any, uploadDir);
    }
  },
  filename: (req: any, file: any, cb: any) => {
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
  fileFilter: (req: any, file: any, cb: any) => {
    if (
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only video and audio files are allowed') as any, false);
    }
  },
});

/**
 * Multer error handler middleware
 */
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction): any => {
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
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
    });
  }
  next();
};

// ─── Internal route (no JWT auth – uses shared secret) ───────────────────────
// Must be registered BEFORE router.use(verifyToken) so mediasoup-service can
// hand off recordings without a user JWT token.
router.post(
  '/internal-finalize',
  upload.single('recording'),
  handleMulterError,
  asyncHandler(recordingController.internalFinalizeRecording.bind(recordingController))
);
// ─────────────────────────────────────────────────────────────────────────────

// Apply authentication and plan validation to all authenticated routes
router.use(verifyToken as any);
router.use(validatePlanStatus as any);

/**
 * @route   POST /api/v1/recordings
 */
router.post(
  '/',
  requirePlanFeature(PLAN_FEATURES.MEETING_RECORDING_BASIC) as any,
  upload.single('recording'),
  handleMulterError,
  asyncHandler(recordingController.uploadRecording.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings
 */
router.get(
  '/',
  requireTeamAccess as any,
  asyncHandler(recordingController.getRecordings.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings/:id
 */
router.get(
  '/:id',
  requireTeamAccess as any,
  asyncHandler(recordingController.getRecording.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings/:id/stream
 */
router.get(
  '/:id/stream',
  asyncHandler(recordingController.getStreamingUrl.bind(recordingController))
);

/**
 * @route   PUT /api/v1/recordings/:id
 */
router.put(
  '/:id',
  asyncHandler(recordingController.updateRecording.bind(recordingController))
);

/**
 * @route   DELETE /api/v1/recordings/:id
 */
router.delete(
  '/:id',
  asyncHandler(recordingController.deleteRecording.bind(recordingController))
);

/**
 * @route   POST /api/v1/recordings/:id/process
 */
router.post(
  '/:id/process',
  requirePlanFeature(PLAN_FEATURES.MEETING_RECORDING_BASIC) as any,
  asyncHandler(recordingController.processRecording.bind(recordingController))
);

/**
 * @route   POST /api/v1/recordings/:id/share
 */
router.post(
  '/:id/share',
  asyncHandler(recordingController.shareRecording.bind(recordingController))
);

/**
 * @route   POST /api/v1/recordings/:id/archive
 */
router.post(
  '/:id/archive',
  asyncHandler(recordingController.archiveRecording.bind(recordingController))
);

/**
 * @route   POST /api/v1/recordings/:id/unarchive
 */
router.post(
  '/:id/unarchive',
  asyncHandler(recordingController.unarchiveRecording.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings/:id/status
 */
router.get(
  '/:id/status',
  asyncHandler(recordingController.getRecordingStatus.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings/stats
 */
router.get(
  '/stats',
  asyncHandler(recordingController.getRecordingStats.bind(recordingController))
);

/**
 * @route   GET /api/v1/recordings/:id/download
 */
router.get(
  '/:id/download',
  asyncHandler(recordingController.downloadRecording.bind(recordingController))
);

export default router;
