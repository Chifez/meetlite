import express from 'express';
import multer from 'multer';
import { verifyToken } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import {
  summarizeMeeting,
  transcribeMeeting,
  suggestMeetingImprovements,
  getMeetingInsights,
  generateMeetingDescription,
  parseMeeting,
} from '../../controllers/ai.controller.js';

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Apply authentication to all routes
router.use(verifyToken);

// Routes using controllers
router.post(
  '/summarize',
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  asyncHandler(summarizeMeeting)
);

router.post(
  '/transcribe',
  upload.single('audio'),
  asyncHandler(transcribeMeeting)
);

router.post('/suggest', asyncHandler(suggestMeetingImprovements));

router.get('/insights/:meetingId', asyncHandler(getMeetingInsights));

router.post('/description', asyncHandler(generateMeetingDescription));

router.post('/parse-meeting', asyncHandler(parseMeeting));

export default router;
