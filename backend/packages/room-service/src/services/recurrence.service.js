import pkg from 'rrule';
import { nanoid } from 'nanoid';

const { RRule, RRuleSet, rrulestr } = pkg;
/**
 * Recurrence Service
 * Handles recurring meeting logic using RFC 5545 RRULE standard
 */

/**
 * Generate RRULE string from recurrence pattern
 * @param {Object} recurrence - Recurrence configuration
 * @param {Date} startDate - Start date of the recurrence
 * @returns {string} RRULE string
 */
export function generateRRULE(recurrence, startDate) {
  const options = {
    dtstart: startDate,
    freq: null, // Will be set based on pattern
    interval: recurrence.interval || 1,
  };

  // Handle different recurrence patterns
  switch (recurrence.pattern) {
    case 'daily':
      options.freq = RRule.DAILY;
      break;

    case 'weekdays':
      options.freq = RRule.DAILY;
      options.byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
      break;

    case 'weekly':
      options.freq = RRule.WEEKLY;
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        // Convert 0 (Sunday) to RRule.SU, 1 (Monday) to RRule.MO, etc.
        const dayMap = [
          RRule.SU,
          RRule.MO,
          RRule.TU,
          RRule.WE,
          RRule.TH,
          RRule.FR,
          RRule.SA,
        ];
        options.byweekday = recurrence.daysOfWeek.map((day) => dayMap[day]);
      } else {
        // Default to same day of week as start date
        const dayOfWeek = new Date(startDate).getDay();
        const dayMap = [
          RRule.SU,
          RRule.MO,
          RRule.TU,
          RRule.WE,
          RRule.TH,
          RRule.FR,
          RRule.SA,
        ];
        options.byweekday = [dayMap[dayOfWeek]];
      }
      break;

    case 'monthly':
      options.freq = RRule.MONTHLY;
      if (recurrence.dayOfMonth) {
        options.bymonthday = recurrence.dayOfMonth;
      } else {
        // Default to same day of month as start date
        options.bymonthday = new Date(startDate).getDate();
      }
      break;

    case 'yearly':
      options.freq = RRule.YEARLY;
      break;

    default:
      // If rrule string is provided, use it directly
      if (recurrence.rrule) {
        return recurrence.rrule;
      }
      throw new Error(`Unsupported recurrence pattern: ${recurrence.pattern}`);
  }

  // Handle end conditions
  if (recurrence.endType === 'after' && recurrence.occurrences) {
    options.count = recurrence.occurrences;
  } else if (recurrence.endType === 'on' && recurrence.endDate) {
    options.until = new Date(recurrence.endDate);
  }
  // 'never' means no end condition

  const rule = new RRule(options);
  return rule.toString();
}

/**
 * Generate recurring meeting occurrences
 * @param {Object} recurrence - Recurrence configuration
 * @param {Date} startDate - Start date of the recurrence
 * @param {number} limit - Maximum number of occurrences to generate (default: 100)
 * @returns {Array<Date>} Array of occurrence dates
 */
export function generateOccurrences(recurrence, startDate, limit = 100) {
  try {
    const rruleString = generateRRULE(recurrence, startDate);
    const rule = rrulestr(rruleString);

    // Generate occurrences up to limit
    const allOccurrences = rule.all();
    return allOccurrences.slice(0, limit);
  } catch (error) {
    console.error('Error generating occurrences:', error);
    return [];
  }
}

/**
 * Get next occurrence date(s) from a recurrence pattern
 * @param {Object} recurrence - Recurrence configuration
 * @param {Date} startDate - Start date of the recurrence
 * @param {Date} afterDate - Get occurrences after this date (default: now)
 * @param {number} count - Number of occurrences to return (default: 10)
 * @returns {Array<Date>} Array of next occurrence dates
 */
export function getNextOccurrences(
  recurrence,
  startDate,
  afterDate = new Date(),
  count = 10
) {
  try {
    const rruleString = generateRRULE(recurrence, startDate);
    const rule = rrulestr(rruleString);

    // Get occurrences between afterDate and a reasonable future date
    const futureLimit = new Date();
    futureLimit.setFullYear(futureLimit.getFullYear() + 1); // 1 year ahead

    const allOccurrences = rule.between(afterDate, futureLimit, true);

    return allOccurrences.slice(0, count);
  } catch (error) {
    console.error('Error getting next occurrences:', error);
    return [];
  }
}

/**
 * Check if a date matches a recurrence pattern
 * @param {Date} date - Date to check
 * @param {Object} recurrence - Recurrence configuration
 * @param {Date} startDate - Start date of the recurrence
 * @returns {boolean} True if date matches the pattern
 */
export function isRecurrenceOccurrence(date, recurrence, startDate) {
  try {
    const occurrences = generateOccurrences(recurrence, startDate, 1000);
    const dateStr = date.toISOString().split('T')[0];

    return occurrences.some((occurrence) => {
      const occurrenceStr = occurrence.toISOString().split('T')[0];
      return occurrenceStr === dateStr;
    });
  } catch (error) {
    console.error('Error checking recurrence occurrence:', error);
    return false;
  }
}

/**
 * Parse RRULE string to recurrence object
 * @param {string} rruleString - RRULE string
 * @param {Date} dtstart - Start date
 * @returns {Object} Recurrence configuration object
 */
export function parseRRULE(rruleString, dtstart) {
  try {
    const rule = rrulestr(rruleString);
    const options = rule.options;

    const recurrence = {
      interval: options.interval || 1,
      endType: 'never',
    };

    // Determine pattern based on frequency
    if (options.freq === RRule.DAILY) {
      if (options.byweekday && options.byweekday.length === 5) {
        // Check if it's weekdays only
        const weekdays = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
        const isWeekdays = weekdays.every((day) =>
          options.byweekday.includes(day)
        );
        recurrence.pattern = isWeekdays ? 'weekdays' : 'weekly';
      } else {
        recurrence.pattern = 'daily';
      }
    } else if (options.freq === RRule.WEEKLY) {
      recurrence.pattern = 'weekly';
      if (options.byweekday) {
        recurrence.daysOfWeek = options.byweekday.map((day) => {
          if (typeof day === 'number') return day;
          // Convert RRule day constants to 0-6
          const dayMap = {
            [RRule.SU]: 0,
            [RRule.MO]: 1,
            [RRule.TU]: 2,
            [RRule.WE]: 3,
            [RRule.TH]: 4,
            [RRule.FR]: 5,
            [RRule.SA]: 6,
          };
          return dayMap[day] ?? day.weekday;
        });
      }
    } else if (options.freq === RRule.MONTHLY) {
      recurrence.pattern = 'monthly';
      if (options.bymonthday) {
        recurrence.dayOfMonth = options.bymonthday[0];
      }
    } else if (options.freq === RRule.YEARLY) {
      recurrence.pattern = 'yearly';
    } else {
      recurrence.pattern = 'custom';
      recurrence.rrule = rruleString;
    }

    // Handle end conditions
    if (options.count) {
      recurrence.endType = 'after';
      recurrence.occurrences = options.count;
    } else if (options.until) {
      recurrence.endType = 'on';
      recurrence.endDate = options.until;
    }

    return recurrence;
  } catch (error) {
    console.error('Error parsing RRULE:', error);
    return null;
  }
}

/**
 * Validate recurrence configuration
 * @param {Object} recurrence - Recurrence configuration
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateRecurrence(recurrence) {
  if (!recurrence || !recurrence.pattern) {
    return { valid: false, error: 'Recurrence pattern is required' };
  }

  const validPatterns = [
    'daily',
    'weekdays',
    'weekly',
    'monthly',
    'yearly',
    'custom',
  ];
  if (!validPatterns.includes(recurrence.pattern)) {
    return {
      valid: false,
      error: `Invalid recurrence pattern: ${recurrence.pattern}`,
    };
  }

  if (
    recurrence.interval &&
    (recurrence.interval < 1 || !Number.isInteger(recurrence.interval))
  ) {
    return {
      valid: false,
      error: 'Recurrence interval must be a positive integer',
    };
  }

  if (recurrence.pattern === 'weekly' && recurrence.daysOfWeek) {
    if (
      !Array.isArray(recurrence.daysOfWeek) ||
      recurrence.daysOfWeek.length === 0
    ) {
      return {
        valid: false,
        error: 'Days of week must be a non-empty array for weekly recurrence',
      };
    }
    const invalidDays = recurrence.daysOfWeek.some(
      (day) => !Number.isInteger(day) || day < 0 || day > 6
    );
    if (invalidDays) {
      return {
        valid: false,
        error:
          'Days of week must be integers between 0 (Sunday) and 6 (Saturday)',
      };
    }
  }

  if (recurrence.pattern === 'monthly' && recurrence.dayOfMonth) {
    if (
      !Number.isInteger(recurrence.dayOfMonth) ||
      recurrence.dayOfMonth < 1 ||
      recurrence.dayOfMonth > 31
    ) {
      return {
        valid: false,
        error: 'Day of month must be an integer between 1 and 31',
      };
    }
  }

  if (recurrence.endType === 'after' && !recurrence.occurrences) {
    return {
      valid: false,
      error: 'Number of occurrences is required when end type is "after"',
    };
  }

  if (recurrence.endType === 'on' && !recurrence.endDate) {
    return {
      valid: false,
      error: 'End date is required when end type is "on"',
    };
  }

  if (
    recurrence.occurrences &&
    (recurrence.occurrences < 1 || !Number.isInteger(recurrence.occurrences))
  ) {
    return {
      valid: false,
      error: 'Number of occurrences must be a positive integer',
    };
  }

  return { valid: true };
}

/**
 * Create recurring meeting instances from a parent meeting
 * @param {Object} parentMeeting - Parent meeting document
 * @param {Object} models - Models object from index
 * @param {Date} startAfter - Create instances after this date
 * @param {Date} endBefore - Create instances before this date (30 days ahead)
 * @returns {Promise<Array>} Array of created meeting instances
 */
export async function createRecurrenceInstances(
  parentMeeting,
  models,
  startAfter = new Date(),
  endBefore = null
) {
  try {
    if (!parentMeeting.isRecurring || !parentMeeting.recurrence) {
      return [];
    }

    // Calculate end date (30 days ahead by default)
    if (!endBefore) {
      endBefore = new Date();
      endBefore.setDate(endBefore.getDate() + 30);
    }

    // Get existing instances to avoid duplicates
    const existingInstances = await models.Meeting.find({
      recurrenceId: parentMeeting._id,
    })
      .select('scheduledTime')
      .lean();

    const existingDates = new Set(
      existingInstances.map(
        (inst) => new Date(inst.scheduledTime).toISOString().split('T')[0]
      )
    );

    // Get next occurrences
    const occurrences = getNextOccurrences(
      parentMeeting.recurrence,
      parentMeeting.scheduledTime,
      startAfter,
      100 // Get up to 100 occurrences
    );

    // Filter occurrences within date range and not already created
    const occurrencesToCreate = occurrences.filter((occurrenceDate) => {
      const dateStr = occurrenceDate.toISOString().split('T')[0];
      return (
        occurrenceDate >= startAfter &&
        occurrenceDate < endBefore &&
        !existingDates.has(dateStr)
      );
    });

    if (occurrencesToCreate.length === 0) {
      return [];
    }

    // Create meeting instances
    const instances = await Promise.all(
      occurrencesToCreate.map(async (occurrenceDate) => {
        const meetingId = nanoid(12);

        // Calculate scheduled time (preserve time from parent, update date)
        const parentTime = new Date(parentMeeting.scheduledTime);
        const scheduledTime = new Date(occurrenceDate);
        scheduledTime.setHours(parentTime.getHours());
        scheduledTime.setMinutes(parentTime.getMinutes());
        scheduledTime.setSeconds(0);
        scheduledTime.setMilliseconds(0);

        // Create instance
        const instance = new models.Meeting({
          meetingId,
          title: parentMeeting.title,
          description: parentMeeting.description,
          scheduledTime,
          duration: parentMeeting.duration,
          createdBy: parentMeeting.createdBy,
          organizationId: parentMeeting.organizationId,
          teamId: parentMeeting.teamId,
          participants: parentMeeting.participants || [],
          privacy: parentMeeting.privacy || 'public',
          invites: (parentMeeting.invites || []).map((invite) => ({
            ...invite,
            status: 'pending', // Reset status for new instances
          })),
          status: 'scheduled',
          isRecurring: false, // Instances are not recurring themselves
          recurrenceId: parentMeeting._id,
        });

        await instance.save();
        return instance;
      })
    );

    return instances;
  } catch (error) {
    console.error('Error creating recurrence instances:', error);
    throw error;
  }
}

/**
 * Cancel all future instances of a recurring meeting series
 * @param {Object} parentMeeting - Parent meeting document
 * @param {Object} models - Models object from index
 * @param {string} cancelReason - Reason for cancellation
 * @returns {Promise<number>} Number of instances cancelled
 */
export async function cancelRecurrenceSeries(
  parentMeeting,
  models,
  cancelReason = 'Series cancelled'
) {
  try {
    const now = new Date();

    // Find all future instances
    const futureInstances = await models.Meeting.find({
      recurrenceId: parentMeeting._id,
      scheduledTime: { $gte: now },
      status: { $ne: 'cancelled' },
    });

    let cancelledCount = 0;

    // Cancel each instance
    await Promise.all(
      futureInstances.map(async (instance) => {
        try {
          instance.status = 'cancelled';
          await instance.save();

          // Cancel reminders for this instance
          const { cancelMeetingReminders } = await import(
            '../services/notification.service.js'
          );
          await cancelMeetingReminders(
            instance.meetingId,
            cancelReason,
            parentMeeting.createdBy
          );

          cancelledCount++;
        } catch (error) {
          console.error(
            `Error cancelling instance ${instance.meetingId}:`,
            error
          );
        }
      })
    );

    // Also mark parent as cancelled
    parentMeeting.status = 'cancelled';
    await parentMeeting.save();

    return cancelledCount;
  } catch (error) {
    console.error('Error cancelling recurrence series:', error);
    throw error;
  }
}
