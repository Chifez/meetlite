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
  verifyToken as any,
  asyncHandler(connectGoogleCalendar)
);
router.post('/import', verifyToken as any, asyncHandler(importCalendarEvents));
router.post('/refresh', verifyToken as any, asyncHandler(refreshCalendarCache));
router.post('/export', verifyToken as any, asyncHandler(exportMeetingToCalendar));
router.post('/conflicts', verifyToken as any, asyncHandler(checkCalendarConflicts));
router.post('/schedule', verifyToken as any, asyncHandler(scheduleMeetingOnCalendar));
router.delete(
  '/events/:eventId',
  verifyToken as any,
  asyncHandler(deleteCalendarEvent)
);
router.get('/connected', verifyToken as any, asyncHandler(getConnectedCalendars));
router.post(
  '/disconnect',
  verifyToken as any,
  asyncHandler(disconnectCalendarIntegration)
);

export default router;
