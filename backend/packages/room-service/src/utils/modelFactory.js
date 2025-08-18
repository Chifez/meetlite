import { calendarIntegrationSchema } from '../models/CalendarIntegration.js';
import { meetingSchema } from '../models/Meeting.js';
import { roomSchema } from '../models/Room.js';
import { meetingSummarySchema } from '../models/MeetingSummary.js';

/**
 * Creates local models using the provided database connection
 * @param {Object} connection - Mongoose connection instance
 * @returns {Object} Object containing all local models
 */
export const createLocalModels = (connection) => {
  return {
    CalendarIntegration: connection.model(
      'CalendarIntegration',
      calendarIntegrationSchema
    ),
    Meeting: connection.model('Meeting', meetingSchema),
    Room: connection.model('Room', roomSchema),
    MeetingSummary: connection.model('MeetingSummary', meetingSummarySchema),
  };
};
