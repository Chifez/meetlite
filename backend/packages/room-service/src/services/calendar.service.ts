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

const refreshGoogleAccessToken = async (integration: any): Promise<any> => {
  if (!integration.refreshToken) {
    throw new Error('Missing refresh token');
  }

  const oauth2Client = createGoogleOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: integration.refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials?.access_token) {
    throw new Error('No access token returned during refresh');
  }

  const expiryDate = credentials.expiry_date
    ? credentials.expiry_date
    : Date.now() + ((credentials as any).expires_in || 3600) * 1000;

  return {
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token || integration.refreshToken,
    expiry_date: expiryDate,
  };
};

// Helper function to get user's calendar tokens from database
export const getUserCalendarTokens = async (
  userId: string,
  calendarType = 'google'
): Promise<any> => {
  try {
    const integration = await models.CalendarIntegration.findOne({
      userId,
      calendarType,
      isConnected: true,
    });

    if (!integration) {
      console.log(
        `[Calendar] No integration found for userId: ${userId} (type: ${typeof userId}), calendarType: ${calendarType}`
      );
      return null;
    }

    if (!integration.isTokenExpired()) {
      return {
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
        expiry_date: integration.tokenExpiry.getTime(),
      };
    }

    console.log(
      `[Calendar] Token expired for userId: ${integration.userId}, calendarType: ${calendarType}. Attempting refresh.`
    );

    try {
      const refreshedTokens = await refreshGoogleAccessToken(integration);

      await saveCalendarTokens(
        userId,
        calendarType,
        refreshedTokens,
        integration.email
      );

      console.log(
        `[Calendar] Token refresh succeeded for userId: ${integration.userId}, calendarType: ${calendarType}`
      );

      return {
        access_token: refreshedTokens.access_token,
        refresh_token:
          refreshedTokens.refresh_token || integration.refreshToken,
        expiry_date: refreshedTokens.expiry_date,
      };
    } catch (refreshError: any) {
      console.error(
        `[Calendar] Failed to refresh tokens for userId: ${integration.userId}, calendarType: ${calendarType} -> ${refreshError.message}`
      );

      await models.CalendarIntegration.findOneAndUpdate(
        { _id: integration._id },
        { isConnected: false, lastSync: new Date() }
      );

      return null;
    }
  } catch (error) {
    console.error('Error fetching calendar tokens:', error);
    return null;
  }
};

// Helper function to save calendar tokens to database
export const saveCalendarTokens = async (
  userId: string,
  calendarType: string,
  tokens: any,
  email: string
): Promise<void> => {
  try {
    const tokenExpiry = new Date(tokens.expiry_date);

    const update: any = {
      accessToken: tokens.access_token,
      tokenExpiry,
      isConnected: true,
      lastSync: new Date(),
      email,
    };

    if (tokens.refresh_token) {
      update.refreshToken = tokens.refresh_token;
    }

    await models.CalendarIntegration.findOneAndUpdate(
      { userId, calendarType },
      update,
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Error saving calendar tokens:', error);
    throw error;
  }
};

// Helper function to disconnect calendar
export const disconnectCalendar = async (userId: string, calendarType: string): Promise<void> => {
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
export const createAuthenticatedGoogleClient = async (userId: string): Promise<any> => {
  const tokens = await getUserCalendarTokens(userId, 'google');
  if (!tokens) {
    throw new Error('Google Calendar not connected');
  }

  const oauth2Client = createGoogleOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
};

// Create authenticated Microsoft Graph client
export const createAuthenticatedMicrosoftClient = (accessToken: string): any => {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
};
