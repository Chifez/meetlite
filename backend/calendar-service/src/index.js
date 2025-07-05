import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import jwt from 'jsonwebtoken';
import { oauthTemplates } from './templates/oauthPage.js';
import mongoose from 'mongoose';

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

// Google Calendar OAuth
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:5004/api/calendar/google/callback' // Hardcode for now to ensure it's correct
);

// Debug: Log the redirect URI being used
console.log('OAuth2 Client configured with:');
console.log('- Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'NOT SET');
console.log(
  '- Client Secret:',
  process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'NOT SET'
);
console.log(
  '- Redirect URI: http://localhost:5004/api/calendar/google/callback'
);

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

// Store user tokens (in production, use a database)
const userTokens = new Map();

// Update callback to store tokens
app.get('/api/calendar/google/callback', async (req, res) => {
  const { code, state: userId } = req.query;

  console.log('OAuth callback received:', {
    code: !!code,
    userId,
    hasState: !!req.query.state,
  });

  try {
    const { tokens } = await oauth2Client.getToken(code);

    console.log('Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
    });

    // Store tokens for the user (in production, save to database)
    userTokens.set(userId, tokens);

    console.log('Tokens stored for user:', userId);
    console.log('Current userTokens size:', userTokens.size);

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

    // Debug: Check if user is properly authenticated
    console.log('req.user:', req.user);
    console.log('req.user.id:', req.user?.id);
    console.log('User ID for OAuth state:', userId);

    // Debug: Log the OAuth2 client configuration
    console.log('OAuth2 Client details:');
    console.log('- Redirect URI:', oauth2Client.redirectUri);
    console.log('- Client ID:', oauth2Client._clientId);

    // Generate OAuth URL for Google Calendar
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      prompt: 'consent',
      state: userId, // Pass user ID in state for callback
    });

    // Debug: Log the generated auth URL
    console.log('Generated OAuth URL:', authUrl);

    // Validate the URL
    try {
      new URL(authUrl);
      console.log('URL is valid');
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
      // Get user's stored tokens
      const userToken = userTokens.get(userId);
      if (!userToken) {
        return res.status(401).json({
          error: 'Google Calendar not connected. Please connect first.',
        });
      }

      // Create new OAuth client with user's tokens
      const userOAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost:5004/api/calendar/google/callback'
      );
      userOAuth2Client.setCredentials(userToken);

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
      console.log('events', events);
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

    // Check for conflicts in connected calendars
    // This is a simplified version - you'd want to check all connected calendars

    const conflicts = [];
    const availableSlots = [
      { start: new Date(startDate), end: new Date(endDate) },
    ];

    res.json({ conflicts, availableSlots });
  } catch (error) {
    console.error('Conflict check error:', error);
    res.status(500).json({ error: 'Failed to check calendar conflicts' });
  }
});

// Get connected calendars
app.get('/api/calendar/connected', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('Checking connected calendars for user:', userId);

    // Check if user has stored tokens
    const hasGoogleToken = userTokens.has(userId);

    console.log('Has Google token:', hasGoogleToken);
    console.log('Current userTokens size:', userTokens.size);
    console.log('UserTokens keys:', Array.from(userTokens.keys()));

    // This would typically fetch from database
    // For now, return mock connected calendars
    const connectedCalendars = [
      {
        id: 'google',
        type: 'google',
        name: 'Google Calendar',
        isConnected: hasGoogleToken,
        lastSync: hasGoogleToken ? new Date() : null,
      },
    ];
    console.log('Returning connected calendars:', connectedCalendars);
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

    if (calendarType === 'google') {
      // Remove user's stored tokens
      userTokens.delete(userId);
    }

    // This would typically remove from database
    // For now, return success
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
