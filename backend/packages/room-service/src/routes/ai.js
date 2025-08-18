import express from 'express';
import multer from 'multer';
import {
  summarizeMeeting,
  transcribeMeeting,
  suggestMeetingImprovements,
  getMeetingInsights,
  generateMeetingDescription,
  parseMeeting,
} from '../controllers/aiController.js';

const router = express.Router();

// Multer configuration for file uploads (same as ai-service)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes using controllers (preserving exact same API structure)
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
