import express from 'express';
import { MeetingController } from '../../controllers/meeting.controller.js';
import { verifyToken } from '../../middleware/auth.js';
import { requireTeamAccess } from '../../middleware/team-access.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import { validatePlanStatus } from '../../middleware/plan-validation.js';

const router = express.Router();
const meetingController = new MeetingController();

// Apply authentication and plan validation to all routes
router.use(verifyToken as any);
router.use(validatePlanStatus as any);

// POST /meetings - Create a new meeting
router.post(
  '/',
  asyncHandler(meetingController.createMeeting.bind(meetingController))
);

// GET /meetings - List meetings (supports teamId query param)
router.get(
  '/',
  requireTeamAccess as any,
  asyncHandler(meetingController.listMeetings.bind(meetingController))
);

// GET /meetings/:meetingId - Get meeting details
router.get(
  '/:meetingId',
  requireTeamAccess as any,
  asyncHandler(meetingController.getMeeting.bind(meetingController))
);

// PUT /meetings/:meetingId - Update meeting
router.put(
  '/:meetingId',
  asyncHandler(meetingController.updateMeeting.bind(meetingController))
);

// DELETE /meetings/:meetingId - Delete meeting
router.delete(
  '/:meetingId',
  asyncHandler(meetingController.deleteMeeting.bind(meetingController))
);

// POST /meetings/:meetingId/validate-token - Validate invite token
router.post(
  '/:meetingId/validate-token',
  asyncHandler(meetingController.validateToken.bind(meetingController))
);

// POST /meetings/:meetingId/start - Start meeting
router.post(
  '/:meetingId/start',
  asyncHandler(meetingController.startMeeting.bind(meetingController))
);

// POST /meetings/:meetingId/complete - Complete meeting
router.post(
  '/:meetingId/complete',
  asyncHandler(meetingController.completeMeeting.bind(meetingController))
);

export default router;
