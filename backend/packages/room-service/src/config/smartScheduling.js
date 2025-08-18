/**
 * Smart Scheduling Configuration Constants
 * These values control the behavior of the calendar conflict checking
 */

const SMART_SCHEDULING_CONFIG = {
  // Working hours (24-hour format)
  WORKING_HOURS: {
    START: 9, // 9 AM
    END: 17, // 5 PM
  },

  // Alternative time offsets in minutes
  ALTERNATIVE_OFFSETS: {
    SHORT: 30, // 30 minutes later
    MEDIUM: 60, // 1 hour later
    LONG: 120, // 2 hours later
  },

  // Business hours validation
  isBusinessHours: (hour) => {
    return (
      hour >= SMART_SCHEDULING_CONFIG.WORKING_HOURS.START &&
      hour <= SMART_SCHEDULING_CONFIG.WORKING_HOURS.END
    );
  },

  // Get alternative offset description
  getOffsetDescription: (offsetMinutes) => {
    if (offsetMinutes < 60) {
      return `${offsetMinutes} minutes later`;
    } else if (offsetMinutes < 120) {
      return '1 hour later';
    } else {
      return '2 hours later';
    }
  },
};

export { SMART_SCHEDULING_CONFIG };
