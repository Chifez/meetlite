import { Connection } from 'mongoose';
import { calendarIntegrationSchema } from '../models/calendar-integration.js';
import { roomSchema } from '../models/Room.js'; // Ensure correct capitalization
import { meetingSummarySchema } from '../models/meeting-summary.js';

/**
 * Creates local models using the provided database connection
 * Note: Meeting model is now in the shared package (createModelFactory)
 * @param {Connection} connection - Mongoose connection instance
 * @returns {Object} Object containing all local models
 */
export const createLocalModels = (connection: Connection) => {
  return {
    CalendarIntegration: connection.model(
      'CalendarIntegration',
      calendarIntegrationSchema
    ),
    Room: connection.model('Room', roomSchema),
    MeetingSummary: connection.model('MeetingSummary', meetingSummarySchema),
  };
};
