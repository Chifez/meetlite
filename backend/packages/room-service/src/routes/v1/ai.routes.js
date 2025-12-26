import express from 'express';
import multer from 'multer';
import { verifyToken } from '../../middleware/auth.js';
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
  summarizeMeeting
);

router.post('/transcribe', upload.single('audio'), transcribeMeeting);

router.post('/suggest', suggestMeetingImprovements);

router.get('/insights/:meetingId', getMeetingInsights);

router.post('/description', generateMeetingDescription);

router.post('/parse-meeting', parseMeeting);

export default router;
