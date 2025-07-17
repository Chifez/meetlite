import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import CalendarIntegration from './models/CalendarIntegration.js';
import { SMART_SCHEDULING_CONFIG } from './config/smartScheduling.js';
import { oauthTemplates } from './templates/oauthPage.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5004;

// Middleware
app.use(cors());
app.use(express.json());

// JWT verification middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper function to get user's calendar tokens from database
const getUserCalendarTokens = async (userId, calendarType = 'google') => {
  try {
    const integration = await CalendarIntegration.findOne({
      userId,
      calendarType,
      isConnected: true,
    });

    if (!integration) {
      return null;
    }

    // Check if token is expired
    if (integration.isTokenExpired()) {
      // TODO: Implement token refresh logic
      console.log(`Token expired for user ${userId}, need to refresh`);
      return null;
    }

    return {
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.tokenExpiry.getTime(),
    };
  } catch (error) {
    console.error('Error fetching calendar tokens:', error);
    return null;
  }
};

// Helper function to save calendar tokens to database
const saveCalendarTokens = async (userId, calendarType, tokens, email) => {
  try {
    const tokenExpiry = new Date(tokens.expiry_date);

    await CalendarIntegration.findOneAndUpdate(
      { userId, calendarType },
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
        isConnected: true,
        lastSync: new Date(),
        email,
      },
      { upsert: true, new: true }
    );

    console.log(`Calendar tokens saved for user ${userId}`);
  } catch (error) {
    console.error('Error saving calendar tokens:', error);
    throw error;
  }
};

// Helper function to disconnect calendar
const disconnectCalendar = async (userId, calendarType) => {
  try {
    await CalendarIntegration.findOneAndUpdate(
      { userId, calendarType },
      { isConnected: false },
      { new: true }
    );

    console.log(`Calendar disconnected for user ${userId}`);
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    throw error;
  }
};

// Google Calendar OAuth
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI // Hardcode for now to ensure it's correct
);

// OAuth2 Client configured

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database:
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };
  res.json(health);
});

// Routes
app.get('/api/calendar/google/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    prompt: 'consent',
  });

  res.json({ authUrl });
});

// Database-based token storage (no longer using in-memory Map)

// Update callback to store tokens
app.get('/api/calendar/google/callback', async (req, res) => {
  const { code, state } = req.query;

  try {
    // Parse state to get user info
    const stateData = JSON.parse(decodeURIComponent(state));
    const { userId, email: userEmail } = stateData;

    const { tokens } = await oauth2Client.getToken(code);

    // Try to get user's email from Google, but don't fail if we can't
    let finalEmail = userEmail; // Use email from JWT as fallback
    try {
      const userOAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      userOAuth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: userOAuth2Client });
      const userInfo = await oauth2.userinfo.get();
      finalEmail = userInfo.data.email; // Use Google's email if available
    } catch (emailError) {
      console.warn(
        'Could not fetch user email from Google:',
        emailError.message
      );
      // Continue with email from JWT
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
});

// Connect Google Calendar
app.post('/api/calendar/connect/google', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // From JWT token
    const userEmail = req.user.email; // From JWT token

    // Create state object with user info
    const stateData = {
      userId,
      email: userEmail,
    };
    const state = encodeURIComponent(JSON.stringify(stateData));

    // Generate OAuth URL for Google Calendar
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
});

app.post('/api/calendar/import', verifyToken, async (req, res) => {
  try {
    const { calendarType, startDate, endDate, accessToken } = req.body;
    const userId = req.user.id; // From JWT token

    if (calendarType === 'google') {
      // Get user's stored tokens from database
      const tokens = await getUserCalendarTokens(userId, 'google');
      if (!tokens) {
        return res.status(401).json({
          error: 'Google Calendar not connected. Please connect first.',
        });
      }

      // Create new OAuth client with user's tokens
      const userOAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
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
      const client = Client.init({
        authProvider: (done) => done(null, accessToken),
      });
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
});

app.post('/api/calendar/export', verifyToken, async (req, res) => {
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
});

app.post('/api/calendar/conflicts', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate, attendees } = req.body;
    const userId = req.user.id;

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
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

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
});

// Schedule meeting directly on Google Calendar
app.post('/api/calendar/schedule', verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      startDate,
      endDate,
      participants,
      calendarType,
    } = req.body;
    const userId = req.user.id;

    if (calendarType === 'google') {
      // Get user's stored tokens from database
      const tokens = await getUserCalendarTokens(userId, 'google');
      if (!tokens) {
        return res.status(401).json({
          error: 'Google Calendar not connected. Please connect first.',
        });
      }

      // Create new OAuth client with user's tokens
      const userOAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
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
});

// Delete event from Google Calendar
app.delete('/api/calendar/events/:eventId', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { calendarType } = req.body;
    const userId = req.user.id;

    if (calendarType === 'google') {
      // Get user's stored tokens from database
      const tokens = await getUserCalendarTokens(userId, 'google');
      if (!tokens) {
        return res.status(401).json({
          error: 'Google Calendar not connected. Please connect first.',
        });
      }

      // Create new OAuth client with user's tokens
      const userOAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
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
});

// Get connected calendars
app.get('/api/calendar/connected', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get connected calendars from database
    const integrations = await CalendarIntegration.find({
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
});

// Disconnect calendar
app.post('/api/calendar/disconnect', verifyToken, async (req, res) => {
  try {
    const { calendarType } = req.body;
    const userId = req.user.id;

    await disconnectCalendar(userId, calendarType);

    res.json({
      success: true,
      message: `${calendarType} calendar disconnected`,
    });
  } catch (error) {
    console.error('Calendar disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Calendar Service connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`Calendar service running on port ${PORT}`);
});
