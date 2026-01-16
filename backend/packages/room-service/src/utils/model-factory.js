import { calendarIntegrationSchema } from '../models/calendar-integration.js';
import { roomSchema } from '../models/room.js';
import { meetingSummarySchema } from '../models/meeting-summary.js';

/**
 * Creates local models using the provided database connection
 * Note: Meeting model is now in the shared package (createModelFactory)
 * @param {Object} connection - Mongoose connection instance
 * @returns {Object} Object containing all local models
 */
export const createLocalModels = (connection) => {
  return {
    CalendarIntegration: connection.model(
      'CalendarIntegration',
      calendarIntegrationSchema
    ),
    Room: connection.model('Room', roomSchema),
    MeetingSummary: connection.model('MeetingSummary', meetingSummarySchema),
  };
};
