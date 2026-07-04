import redisClient from '../config/redis.js';
import {
  getUserCalendarTokens,
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
const getCacheKey = (userId: string, startDate: Date | string, endDate: Date | string): string => {
  const start = new Date(startDate).toISOString().split('T')[0];
  const end = new Date(endDate).toISOString().split('T')[0];
  return `${CACHE_PREFIX}:${userId}:${start}:${end}`;
};

/**
 * Fetch Google Calendar events with caching
 */
export const getCachedCalendarEvents = async (
  userId: string,
  startDate: Date | string,
  endDate: Date | string,
  forceRefresh = false
): Promise<any[]> => {
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

    const oauth2Client = new google.auth.OAuth2(
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

    const events = (response.data.items || []).map((event: any) => ({
      id: event.id,
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      attendees:
        event.attendees?.map((a: any) => ({
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
      }
    }

    return events;
  } catch (error) {
    console.error('[Calendar Cache] Error fetching calendar events:', error);
    return [];
  }
};

/**
 * Invalidate calendar cache for a user
 * This is called when meetings are created/updated/deleted
 */
export const invalidateCalendarCache = async (userId: string): Promise<void> => {
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
  }
};

/**
 * Convert Google Calendar event to meeting format
 */
export const convertCalendarEventToMeeting = (event: any, userId: string): any => {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000); // minutes

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
    isCalendarEvent: true,
    calendarType: 'google',
    createdBy: userId,
  };
};
