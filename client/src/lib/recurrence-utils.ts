import { Meeting } from '@/lib/types';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Format recurrence pattern for display
 */
export function formatRecurrenceFrequency(meeting: Meeting): string | null {
  if (!meeting.isRecurring || !meeting.recurrence) {
    return null;
  }

  const { pattern, interval = 1, daysOfWeek, dayOfMonth } = meeting.recurrence;

  // If pattern is missing, return null (can't format without pattern)
  if (!pattern) {
    return null;
  }

  const patternLabels: Record<string, string> = {
    daily: 'Daily',
    weekdays: 'Weekdays',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    custom: 'Custom',
  };

  const baseLabel = patternLabels[pattern] || pattern;

  // For weekdays, no interval needed
  if (pattern === 'weekdays') {
    return baseLabel;
  }

  // For weekly patterns, show day(s) of week if available
  if (pattern === 'weekly') {
    if (daysOfWeek && daysOfWeek.length > 0) {
      const dayNames = daysOfWeek
        .map((day) => DAY_NAMES[day])
        .filter(Boolean)
        .join(', ');

      if (interval > 1) {
        return `${baseLabel} (Every ${interval} weeks on ${dayNames})`;
      }
      return `${baseLabel} (Every ${dayNames})`;
    }

    // Fallback: show interval if no days specified
    if (interval > 1) {
      return `${baseLabel} (Every ${interval} weeks)`;
    }
    return baseLabel;
  }

  // For monthly patterns, show day of month if available
  if (pattern === 'monthly') {
    if (dayOfMonth) {
      const suffix = getDaySuffix(dayOfMonth);
      if (interval > 1) {
        return `${baseLabel} (Every ${interval} months on the ${dayOfMonth}${suffix})`;
      }
      return `${baseLabel} (On the ${dayOfMonth}${suffix})`;
    }

    // Fallback: show interval if no day specified
    if (interval > 1) {
      return `${baseLabel} (Every ${interval} months)`;
    }
    return baseLabel;
  }

  // For other patterns with interval > 1, include the interval
  if (interval > 1) {
    const intervalLabel =
      pattern === 'daily' ? 'days' : pattern === 'yearly' ? 'years' : 'periods';
    return `${baseLabel} (Every ${interval} ${intervalLabel})`;
  }

  return baseLabel;
}

/**
 * Get ordinal suffix for day of month (1st, 2nd, 3rd, 4th, etc.)
 */
function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
