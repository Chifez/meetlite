import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { models } from '../index.js';
import { SMART_SCHEDULING_CONFIG } from '../config/smartScheduling.js';
import { oauthTemplates } from '../templates/oauthPage.js';
import {
  createGoogleOAuth2Client,
  getUserCalendarTokens,
  saveCalendarTokens,
  disconnectCalendar,
  createAuthenticatedGoogleClient,
  createAuthenticatedMicrosoftClient,
} from '../services/calendarService.js';

// Google Calendar OAuth
export const getGoogleAuthUrl = (req, res) => {
  const oauth2Client = createGoogleOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    prompt: 'consent',
  });

  res.json({ authUrl });
};

// Google OAuth callback
export const handleGoogleCallback = async (req, res) => {
  const { code, state } = req.query;

  try {
    // Parse state to get user info
    const stateData = JSON.parse(decodeURIComponent(state));
    const { userId, email: userEmail } = stateData;

    const oauth2Client = createGoogleOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Try to get user's email from Google, but don't fail if we can't
    let finalEmail = userEmail; // Use email from JWT as fallback
    try {
      const userOAuth2Client = createGoogleOAuth2Client();
      userOAuth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: userOAuth2Client });
      const userInfo = await oauth2.userinfo.get();
      finalEmail = userInfo.data.email; // Use Google's email if available
    } catch (emailError) {
      // Could not fetch user email from Google, continue with email from JWT
    }

    // Save tokens to database
    await saveCalendarTokens(userId, 'google', tokens, finalEmail);

    // Send success page that closes the popup
    res.send(oauthTemplates.googleSuccess());
  } catch (error) {
    console.error('Google OAuth error:', error);
    // Send error page
    res.send(oauthTemplates.googleError());
  }
};

// Connect Google Calendar
export const connectGoogleCalendar = async (req, res) => {
  try {
    const userId = req.user.userId; // From JWT token
    const userEmail = req.user.email; // From JWT token

    // Create state object with user info
    const stateData = {
      userId,
      email: userEmail,
    };
    const state = encodeURIComponent(JSON.stringify(stateData));

    // Generate OAuth URL for Google Calendar
    const oauth2Client = createGoogleOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      prompt: 'consent',
      state: state, // Pass user info in state for callback
    });

    // Validate the URL
    try {
      new URL(authUrl);
    } catch (urlError) {
      console.error('Generated URL is invalid:', urlError);
      throw new Error('Invalid OAuth URL generated');
    }

    // In a real app, you'd store the pending connection in database
    // For now, return the auth URL for the frontend to redirect to
    res.json({
      success: true,
      authUrl,
      message: 'Google Calendar connection initiated',
    });
  } catch (error) {
    console.error('Google connection error:', error);
    res.status(500).json({ error: 'Failed to connect Google Calendar' });
  }
};

// Import calendar events
export const importCalendarEvents = async (req, res) => {
  try {
    const { calendarType, startDate, endDate, accessToken } = req.body;
    const userId = req.user.userId; // From JWT token

    if (calendarType === 'google') {
      // Get user's stored tokens from database
      const tokens = await getUserCalendarTokens(userId, 'google');
      if (!tokens) {
        return res.status(409).json({
          error:
            'Google Calendar not connected. Please reconnect your account.',
          code: 'GOOGLE_REAUTH_REQUIRED',
        });
      }

      // Create new OAuth client with user's tokens
      const userOAuth2Client = createGoogleOAuth2Client();
      userOAuth2Client.setCredentials(tokens);

      const calendar = google.calendar({
        version: 'v3',
        auth: userOAuth2Client,
      });

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate,
        timeMax: endDate,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items.map((event) => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        attendees: event.attendees?.map((a) => a.email) || [],
        location: event.location,
        source: 'google',
      }));
      res.json(events);
    } else if (calendarType === 'outlook') {
      if (!accessToken) {
        return res.status(400).json({ error: 'Missing Outlook access token' });
      }
      const client = createAuthenticatedMicrosoftClient(accessToken);
      const events = [];
      try {
        const response = await client
          .api('/me/events')
          .filter(
            `start/dateTime ge '${startDate}' and end/dateTime le '${endDate}'`
          )
          .select('id,subject,bodyPreview,start,end,attendees,location')
          .orderby('start/dateTime')
          .get();
        if (response.value && Array.isArray(response.value)) {
          response.value.forEach((event) => {
            events.push({
              id: event.id,
              title: event.subject,
              description: event.bodyPreview,
              start: event.start.dateTime,
              end: event.end.dateTime,
              attendees:
                event.attendees?.map((a) => a.emailAddress?.address) || [],
              location: event.location?.displayName,
              source: 'outlook',
            });
          });
        }
        res.json(events);
      } catch (err) {
        console.error('Outlook import error:', err);
        res.status(500).json({ error: 'Failed to import Outlook events' });
      }
    } else {
      res.status(400).json({ error: 'Unsupported calendar type' });
    }
  } catch (error) {
    console.error('Calendar import error:', error);
    res.status(500).json({ error: 'Failed to import calendar events' });
  }
};

// Export meeting to calendar
export const exportMeetingToCalendar = async (req, res) => {
  try {
    const { meetingId, calendarType } = req.body;

    // Get meeting details from your database
    const meeting = {
      title: 'Sample Meeting',
      description: 'Meeting description',
      start: new Date(),
      end: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
      attendees: ['user1@example.com', 'user2@example.com'],
    };

    if (calendarType === 'google') {
      const oauth2Client = createGoogleOAuth2Client();
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const event = {
        summary: meeting.title,
        description: meeting.description,
        start: {
          dateTime: meeting.start.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: meeting.end.toISOString(),
          timeZone: 'UTC',
        },
        attendees: meeting.attendees.map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      res.json({ success: true, eventId: response.data.id });
    } else {
      res.status(400).json({ error: 'Unsupported calendar type' });
    }
  } catch (error) {
    console.error('Calendar export error:', error);
    res.status(500).json({ error: 'Failed to export meeting to calendar' });
  }
};

// Check calendar conflicts
export const checkCalendarConflicts = async (req, res) => {
  try {
    const { startDate, endDate, attendees } = req.body;
    const userId = req.user.userId;

    // Check if user has Google Calendar connected
    const tokens = await getUserCalendarTokens(userId, 'google');

    if (!tokens) {
      return res.json({
        conflicts: [],
        availableSlots: [
          { start: new Date(startDate), end: new Date(endDate) },
        ],
      });
    }

    // Get Google Calendar events for the time range
    const oauth2Client = createGoogleOAuth2Client();
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Fetch events from Google Calendar
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate,
      timeMax: endDate,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // Check for conflicts
    const conflicts = [];
    const requestedStart = new Date(startDate);
    const requestedEnd = new Date(endDate);

    events.forEach((event) => {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      const eventEnd = new Date(event.end.dateTime || event.end.date);

      // Check for overlap
      const hasConflict =
        (requestedStart < eventEnd && requestedEnd > eventStart) ||
        (eventStart < requestedEnd && eventEnd > requestedStart);

      if (hasConflict) {
        conflicts.push({
          id: event.id,
          title: event.summary || 'Untitled Event',
          start: eventStart,
          end: eventEnd,
          description: event.description,
          attendees: event.attendees?.map((a) => a.email) || [],
          location: event.location,
          source: 'google',
        });
      }
    });

    // Generate available slots (simplified - just suggest the original time if no conflicts)
    const availableSlots =
      conflicts.length === 0
        ? [{ start: requestedStart, end: requestedEnd }]
        : [];

    // Generate alternative slots if there are conflicts
    if (conflicts.length > 0) {
      const alternatives = [];

      // Find the latest end time among all conflicts
      const latestConflictEnd = Math.max(
        ...conflicts.map((conflict) => new Date(conflict.end).getTime())
      );
      const startFromTime = Math.max(
        requestedStart.getTime(),
        latestConflictEnd
      );

      // Suggest alternatives using configured offsets from the conflict-free start time
      const timeOffsets = [
        SMART_SCHEDULING_CONFIG.ALTERNATIVE_OFFSETS.SHORT,
        SMART_SCHEDULING_CONFIG.ALTERNATIVE_OFFSETS.MEDIUM,
        SMART_SCHEDULING_CONFIG.ALTERNATIVE_OFFSETS.LONG,
      ];

      timeOffsets.forEach((offsetMinutes) => {
        const newTime = new Date(startFromTime + offsetMinutes * 60 * 1000);
        const newEnd = new Date(
          newTime.getTime() +
            (requestedEnd.getTime() - requestedStart.getTime())
        );

        // Only add if it's within business hours
        const hour = newTime.getHours();
        if (SMART_SCHEDULING_CONFIG.isBusinessHours(hour)) {
          alternatives.push({
            start: newTime,
            end: newEnd,
          });
        }
      });

      availableSlots.push(...alternatives);
    }

    res.json({ conflicts, availableSlots });
  } catch (error) {
    console.error('❌ Calendar conflict check error:', error);
    res.status(500).json({ error: 'Failed to check calendar conflicts' });
  }
};

// Schedule meeting directly on Google Calendar
export const scheduleMeetingOnCalendar = async (req, res) => {
  try {
    const {
      title,
      description,
      startDate,
      endDate,
      participants,
      calendarType,
    } = req.body;
    const userId = req.user.userId;

    if (calendarType === 'google') {
      // Get user's stored tokens from database
      const tokens = await getUserCalendarTokens(userId, 'google');
      if (!tokens) {
        return res.status(409).json({
          error:
            'Google Calendar not connected. Please reconnect your account.',
          code: 'GOOGLE_REAUTH_REQUIRED',
        });
      }

      // Create new OAuth client with user's tokens
      const userOAuth2Client = createGoogleOAuth2Client();
      userOAuth2Client.setCredentials(tokens);

      const calendar = google.calendar({
        version: 'v3',
        auth: userOAuth2Client,
      });

      // Create the calendar event
      const event = {
        summary: title,
        description: description || '',
        start: {
          dateTime: new Date(startDate).toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: new Date(endDate).toISOString(),
          timeZone: 'UTC',
        },
        attendees: participants.map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all', // Send email notifications to attendees
      });

      res.json({
        success: true,
        eventId: response.data.id,
        message: 'Meeting scheduled successfully on Google Calendar',
      });
    } else {
      res.status(400).json({ error: 'Unsupported calendar type' });
    }
  } catch (error) {
    console.error('Calendar scheduling error:', error);
    res.status(500).json({ error: 'Failed to schedule meeting on calendar' });
  }
};

// Delete event from Google Calendar
export const deleteCalendarEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { calendarType } = req.body;
    const userId = req.user.userId;

    if (calendarType === 'google') {
      // Get user's stored tokens from database
      const tokens = await getUserCalendarTokens(userId, 'google');
      if (!tokens) {
        return res.status(409).json({
          error:
            'Google Calendar not connected. Please reconnect your account.',
          code: 'GOOGLE_REAUTH_REQUIRED',
        });
      }

      // Create new OAuth client with user's tokens
      const userOAuth2Client = createGoogleOAuth2Client();
      userOAuth2Client.setCredentials(tokens);

      const calendar = google.calendar({
        version: 'v3',
        auth: userOAuth2Client,
      });

      // Delete the calendar event
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all', // Send cancellation emails to attendees
      });

      res.json({
        success: true,
        message: 'Event deleted successfully from Google Calendar',
      });
    } else {
      res.status(400).json({ error: 'Unsupported calendar type' });
    }
  } catch (error) {
    console.error('Calendar deletion error:', error);
    res.status(500).json({ error: 'Failed to delete event from calendar' });
  }
};

// Get connected calendars
export const getConnectedCalendars = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get connected calendars from database
    const integrations = await models.CalendarIntegration.find({
      userId,
      isConnected: true,
    });

    const connectedCalendars = integrations.map((integration) => ({
      id: integration.calendarType,
      type: integration.calendarType,
      name: `${
        integration.calendarType.charAt(0).toUpperCase() +
        integration.calendarType.slice(1)
      } Calendar`,
      isConnected: integration.isConnected,
      lastSync: integration.lastSync,
      email: integration.email,
    }));

    res.json(connectedCalendars);
  } catch (error) {
    console.error('Get connected calendars error:', error);
    res.status(500).json({ error: 'Failed to get connected calendars' });
  }
};

// Disconnect calendar
export const disconnectCalendarIntegration = async (req, res) => {
  try {
    const { calendarType } = req.body;
    const userId = req.user.userId;

    await disconnectCalendar(userId, calendarType);

    res.json({
      success: true,
      message: `${calendarType} calendar disconnected`,
    });
  } catch (error) {
    console.error('Calendar disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
};
