import express from 'express';
import { verifyToken } from '../middleware/auth.js';
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
} from '../controllers/calendarController.js';

const router = express.Router();

// Public routes (no authentication required for OAuth callbacks)
router.get('/google/auth', getGoogleAuthUrl);
router.get('/google/callback', handleGoogleCallback);

// Authenticated routes (require JWT token)
router.post('/connect/google', verifyToken, connectGoogleCalendar);
router.post('/import', verifyToken, importCalendarEvents);
router.post('/export', verifyToken, exportMeetingToCalendar);
router.post('/conflicts', verifyToken, checkCalendarConflicts);
router.post('/schedule', verifyToken, scheduleMeetingOnCalendar);
router.delete('/events/:eventId', verifyToken, deleteCalendarEvent);
router.get('/connected', verifyToken, getConnectedCalendars);
router.post('/disconnect', verifyToken, disconnectCalendarIntegration);

export default router;
