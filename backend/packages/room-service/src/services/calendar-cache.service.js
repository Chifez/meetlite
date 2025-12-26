import redisClient from '../config/redis.js';
import {
  getUserCalendarTokens,
  createAuthenticatedGoogleClient,
} from './calendar.service.js';
import { google } from 'googleapis';

/**
 * Calendar Cache Service
 * Handles caching of Google Calendar events to reduce API calls
 * Cache key format: calendar:events:{userId}:{startDate}:{endDate}
 * Cache TTL: 5 minutes (300 seconds)
 */

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'calendar:events';

/**
 * Generate cache key for calendar events
 */
const getCacheKey = (userId, startDate, endDate) => {
  const start = new Date(startDate).toISOString().split('T')[0];
  const end = new Date(endDate).toISOString().split('T')[0];
  return `${CACHE_PREFIX}:${userId}:${start}:${end}`;
};

/**
 * Fetch Google Calendar events with caching
 */
export const getCachedCalendarEvents = async (
  userId,
  startDate,
  endDate,
  forceRefresh = false
) => {
  try {
    const cacheKey = getCacheKey(userId, startDate, endDate);

    // Try to get from cache first (unless force refresh)
    if (!forceRefresh && redisClient.isReady()) {
      try {
        const cached = await redisClient.getClient().get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          console.log(
            `[Calendar Cache] Cache hit for userId: ${userId}, key: ${cacheKey}`
          );
          return parsed;
        }
      } catch (cacheError) {
        console.warn('[Calendar Cache] Cache read error:', cacheError);
        // Continue to fetch from API if cache fails
      }
    }

    // Fetch from Google Calendar API
    console.log(
      `[Calendar Cache] Cache miss for userId: ${userId}, fetching from API`
    );
    const tokens = await getUserCalendarTokens(userId, 'google');
    if (!tokens) {
      return []; // No calendar connected
    }

    const oauth2Client = google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date(startDate).toISOString(),
      timeMax: new Date(endDate).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500, // Google Calendar API limit
    });

    const events = (response.data.items || []).map((event) => ({
      id: event.id,
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      attendees:
        event.attendees?.map((a) => ({
          email: a.email,
          name: a.displayName || a.email,
          responseStatus: a.responseStatus,
        })) || [],
      location: event.location || '',
      source: 'google',
      externalId: event.id,
      htmlLink: event.htmlLink,
      status: event.status,
      organizer: event.organizer
        ? {
            email: event.organizer.email,
            name: event.organizer.displayName || event.organizer.email,
          }
        : null,
    }));

    // Cache the results
    if (redisClient.isReady()) {
      try {
        await redisClient
          .getClient()
          .setex(cacheKey, CACHE_TTL, JSON.stringify(events));
        console.log(
          `[Calendar Cache] Cached events for userId: ${userId}, count: ${events.length}`
        );
      } catch (cacheError) {
        console.warn('[Calendar Cache] Cache write error:', cacheError);
        // Don't fail the request if caching fails
      }
    }

    return events;
  } catch (error) {
    console.error('[Calendar Cache] Error fetching calendar events:', error);
    // Return empty array on error to not break meetings list
    return [];
  }
};

/**
 * Invalidate calendar cache for a user
 * This is called when meetings are created/updated/deleted
 */
export const invalidateCalendarCache = async (userId) => {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const pattern = `${CACHE_PREFIX}:${userId}:*`;
    const keys = await redisClient.getClient().keys(pattern);

    if (keys.length > 0) {
      await redisClient.getClient().del(...keys);
      console.log(
        `[Calendar Cache] Invalidated ${keys.length} cache entries for userId: ${userId}`
      );
    }
  } catch (error) {
    console.error('[Calendar Cache] Error invalidating cache:', error);
    // Don't throw - cache invalidation failure shouldn't break the app
  }
};

/**
 * Convert Google Calendar event to meeting format
 */
export const convertCalendarEventToMeeting = (event, userId) => {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const duration = Math.round((endDate - startDate) / 60000); // minutes

  return {
    meetingId: `google-${event.id}`,
    title: event.title,
    description: event.description,
    scheduledTime: event.start,
    duration,
    participants: event.attendees || [],
    privacy: 'public',
    status: 'scheduled',
    source: 'google',
    externalId: event.externalId,
    location: event.location,
    htmlLink: event.htmlLink,
    organizer: event.organizer,
    // These fields help identify calendar events
    isCalendarEvent: true,
    calendarType: 'google',
    // Set createdBy to userId to ensure user can see their calendar events
    createdBy: userId,
  };
};


