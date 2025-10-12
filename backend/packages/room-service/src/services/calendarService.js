import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { models } from '../index.js';

// Google OAuth2 client
export const createGoogleOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// Helper function to get user's calendar tokens from database
export const getUserCalendarTokens = async (
  userId,
  calendarType = 'google'
) => {
  try {
    const integration = await models.CalendarIntegration.findOne({
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
export const saveCalendarTokens = async (
  userId,
  calendarType,
  tokens,
  email
) => {
  try {
    const tokenExpiry = new Date(tokens.expiry_date);

    await models.CalendarIntegration.findOneAndUpdate(
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
  } catch (error) {
    console.error('Error saving calendar tokens:', error);
    throw error;
  }
};

// Helper function to disconnect calendar
export const disconnectCalendar = async (userId, calendarType) => {
  try {
    await models.CalendarIntegration.findOneAndUpdate(
      { userId, calendarType },
      { isConnected: false },
      { new: true }
    );
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    throw error;
  }
};

// Create authenticated Google Calendar client
export const createAuthenticatedGoogleClient = async (userId) => {
  const tokens = await getUserCalendarTokens(userId, 'google');
  if (!tokens) {
    throw new Error('Google Calendar not connected');
  }

  const oauth2Client = createGoogleOAuth2Client();
  oauth2Client.setCredentials(tokens);

  return google.calendar({ version: 'v3', auth: oauth2Client });
};

// Create authenticated Microsoft Graph client
export const createAuthenticatedMicrosoftClient = (accessToken) => {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
};
