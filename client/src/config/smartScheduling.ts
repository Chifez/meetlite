/**
 * Smart Scheduling Configuration Constants
 * These values control the behavior of the enhanced smart scheduling system
 */

export const SMART_SCHEDULING_CONFIG = {
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
    NEXT_DAY: 24 * 60, // Next day same time
  },

  // Maximum number of alternative suggestions to show
  MAX_ALTERNATIVES: 5,

  // Default meeting duration if not specified (in minutes)
  DEFAULT_DURATION: 30,

  // Business hours validation
  isBusinessHours: (hour: number): boolean => {
    return (
      hour >= SMART_SCHEDULING_CONFIG.WORKING_HOURS.START &&
      hour <= SMART_SCHEDULING_CONFIG.WORKING_HOURS.END
    );
  },

  // Get working hours as a readable string
  getWorkingHoursString: (): string => {
    const start = SMART_SCHEDULING_CONFIG.WORKING_HOURS.START;
    const end = SMART_SCHEDULING_CONFIG.WORKING_HOURS.END;
    return `${start}:00 - ${end}:00`;
  },

  // Get alternative offset description
  getOffsetDescription: (offsetMinutes: number): string => {
    if (offsetMinutes < 60) {
      return `${offsetMinutes} minutes later`;
    } else if (offsetMinutes < 120) {
      return '1 hour later';
    } else if (offsetMinutes < 180) {
      return '2 hours later';
    } else {
      return 'Next day';
    }
  },
} as const;

// Export individual constants for easy access
export const WORKING_HOURS = SMART_SCHEDULING_CONFIG.WORKING_HOURS;
export const ALTERNATIVE_OFFSETS = SMART_SCHEDULING_CONFIG.ALTERNATIVE_OFFSETS;
export const MAX_ALTERNATIVES = SMART_SCHEDULING_CONFIG.MAX_ALTERNATIVES;
export const DEFAULT_DURATION = SMART_SCHEDULING_CONFIG.DEFAULT_DURATION;
