import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { verifyToken } from '../../middleware/auth.js';
import { requireTeamAccess } from '../../middleware/team-access.js';
import { asyncHandler } from '../../middleware/error-handler.js';
// Import existing route handlers - we'll wrap them
import recordingsRouter from '../recordings.js';

const router = express.Router();

// Configure multer (same as original)
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

// Mount the existing recordings router
// Note: recordings router handles its own authentication via verifyToken middleware in index.js
// This preserves all existing functionality while using versioned path
router.use('/', recordingsRouter);

export default router;
