import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import jwt from 'jsonwebtoken';
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
  process.env.GOOGLE_REDIRECT_URI
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

app.get('/api/calendar/google/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store tokens in database for the user
    // This is a simplified version - you'd want to store this securely

    res.json({
      success: true,
      message: 'Google Calendar connected successfully',
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ error: 'Failed to connect Google Calendar' });
  }
});

app.post('/api/calendar/import', verifyToken, async (req, res) => {
  try {
    const { calendarType, startDate, endDate, accessToken } = req.body;

    if (calendarType === 'google') {
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

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

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Calendar Service connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`Calendar service running on port ${PORT}`);
});
