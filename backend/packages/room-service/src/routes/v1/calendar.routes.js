import express from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/error-handler.js';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  connectGoogleCalendar,
  importCalendarEvents,
  exportMeetingToCalendar,
  checkCalendarConflicts,
  scheduleMeetingOnCalendar,
  deleteCalendarEvent,
  getConnectedCalendars,
  disconnectCalendarIntegration,
  refreshCalendarCache,
} from '../../controllers/calendar.controller.js';

const router = express.Router();

// Public routes (no authentication required for OAuth callbacks)
router.get('/google/auth', getGoogleAuthUrl);
router.get('/google/callback', asyncHandler(handleGoogleCallback));

// Authenticated routes (require JWT token)
router.post(
  '/connect/google',
  verifyToken,
  asyncHandler(connectGoogleCalendar)
);
router.post('/import', verifyToken, asyncHandler(importCalendarEvents));
router.post('/refresh', verifyToken, asyncHandler(refreshCalendarCache));
router.post('/export', verifyToken, asyncHandler(exportMeetingToCalendar));
router.post('/conflicts', verifyToken, asyncHandler(checkCalendarConflicts));
router.post('/schedule', verifyToken, asyncHandler(scheduleMeetingOnCalendar));
router.delete(
  '/events/:eventId',
  verifyToken,
  asyncHandler(deleteCalendarEvent)
);
router.get('/connected', verifyToken, asyncHandler(getConnectedCalendars));
router.post(
  '/disconnect',
  verifyToken,
  asyncHandler(disconnectCalendarIntegration)
);

export default router;
