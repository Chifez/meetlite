import { DateTime } from 'luxon';
import {
  DeterministicSignals,
  RecurrenceSpec,
  SmartScheduleIntent,
  TeamContext,
} from './smart-scheduling.schema.js';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const WEEKDAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

export class DeterministicNlpExtractor {
  /**
   * Extracts structural signals directly from natural language input.
   */
  public static extractSignals(
    input: string,
    timezone: string,
    teamsContext: TeamContext[] = [],
    nowReference?: DateTime
  ): DeterministicSignals {
    const rawInput = input || '';
    const lower = rawInput.toLowerCase();
    const zone = timezone || 'UTC';
    const now = nowReference || DateTime.now().setZone(zone);

    // 1. Extract Emails
    const emailMatches = rawInput.match(EMAIL_REGEX) || [];
    const participants = Array.from(new Set(emailMatches.map((e) => e.toLowerCase())));

    // 2. Expand Team references from teamsContext
    if (teamsContext && teamsContext.length > 0) {
      for (const team of teamsContext) {
        const teamName = team.name.toLowerCase();
        // Check if team name or "the <teamName>" or "<teamName> team" is in input
        const teamKeywords = [
          teamName,
          `the ${teamName}`,
          `${teamName} team`,
          `the ${teamName} team`,
        ];
        const hasTeamMatch = teamKeywords.some((kw) => lower.includes(kw));
        if (hasTeamMatch && Array.isArray(team.members)) {
          for (const member of team.members) {
            if (member.email && !participants.includes(member.email.toLowerCase())) {
              participants.push(member.email.toLowerCase());
            }
          }
        }
      }
    }

    // 3. Extract Privacy
    let detectedPrivacy: 'public' | 'private' | undefined;
    if (/\b(private|confidential|internal|secret|restricted)\b/i.test(lower)) {
      detectedPrivacy = 'private';
    } else if (/\b(public|open)\b/i.test(lower)) {
      detectedPrivacy = 'public';
    }

    // 4. Extract Duration
    let detectedDuration: number | undefined;
    const durationMatch = lower.match(
      /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/
    );
    if (durationMatch) {
      const val = parseFloat(durationMatch[1]);
      const unit = durationMatch[2];
      if (unit.startsWith('h')) {
        detectedDuration = Math.round(val * 60);
      } else {
        detectedDuration = Math.round(val);
      }
      if (detectedDuration < 5) detectedDuration = 5;
      if (detectedDuration > 480) detectedDuration = 480;
    }

    // 5. Extract Recurrence
    const detectedRecurrence: Partial<RecurrenceSpec> = {};
    const isRecurring = /\b(every|recurring|recur|repeat|repeating|weekly|daily|weekdays|monthly|annually|yearly|bi-weekly|biweekly)\b/i.test(
      lower
    );

    if (isRecurring) {
      detectedRecurrence.enabled = true;
      detectedRecurrence.interval = 1;
      detectedRecurrence.endType = 'never';

      if (/\b(every\s+day|daily)\b/i.test(lower)) {
        detectedRecurrence.pattern = 'daily';
      } else if (/\b(weekdays|mon-fri|monday to friday)\b/i.test(lower)) {
        detectedRecurrence.pattern = 'weekdays';
      } else if (/\b(every\s+month|monthly)\b/i.test(lower)) {
        detectedRecurrence.pattern = 'monthly';
      } else if (/\b(every\s+year|yearly|annually)\b/i.test(lower)) {
        detectedRecurrence.pattern = 'yearly';
      } else {
        detectedRecurrence.pattern = 'weekly';
      }

      // Check for interval (e.g. "every 2 weeks", "every other week")
      const intervalMatch = lower.match(/\bevery\s+(\d+)\s+(day|week|month|year)s?\b/i);
      if (intervalMatch) {
        detectedRecurrence.interval = parseInt(intervalMatch[1], 10);
      } else if (/\b(every other week|biweekly|bi-weekly)\b/i.test(lower)) {
        detectedRecurrence.pattern = 'weekly';
        detectedRecurrence.interval = 2;
      }

      // Check for recurring days of the week (e.g. "every tuesday and thursday")
      const matchedDays: number[] = [];
      for (const [dayName, dayNum] of Object.entries(WEEKDAY_NAMES)) {
        const dayPattern = new RegExp(`\\bevery\\s+.*?\\b${dayName}\\b`, 'i');
        if (dayPattern.test(lower) || (lower.includes('every') && new RegExp(`\\b${dayName}s?\\b`, 'i').test(lower))) {
          if (!matchedDays.includes(dayNum)) {
            matchedDays.push(dayNum);
          }
        }
      }
      if (matchedDays.length > 0) {
        detectedRecurrence.daysOfWeek = matchedDays.sort((a, b) => a - b);
      }

      // Check for end conditions
      const endUntilMatch = lower.match(/\b(?:until|ending|through)\s+(\d{4}-\d{2}-\d{2})\b/i);
      if (endUntilMatch) {
        detectedRecurrence.endType = 'on';
        detectedRecurrence.endDate = endUntilMatch[1];
      }

      const occurrencesMatch = lower.match(/\b(?:for)\s+(\d+)\s+(?:times|occurrences|sessions|meetings)\b/i);
      if (occurrencesMatch) {
        detectedRecurrence.endType = 'after';
        detectedRecurrence.occurrences = parseInt(occurrencesMatch[1], 10);
      }
    }

    // 6. Extract Time
    let detectedTime: string | undefined;

    // Check special times
    if (/\b(noon|midday)\b/i.test(lower)) {
      detectedTime = '12:00';
    } else if (/\b(midnight)\b/i.test(lower)) {
      detectedTime = '00:00';
    }

    if (!detectedTime) {
      // 12-hour or 24-hour time: e.g. "2:30pm", "2pm", "14:30", "at 9am", "at 9"
      const timeRegex12 = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
      const match12 = lower.match(timeRegex12);

      if (match12) {
        let hours = parseInt(match12[1], 10);
        const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
        const meridian = match12[3].toLowerCase();

        if (meridian === 'pm' && hours < 12) hours += 12;
        if (meridian === 'am' && hours === 12) hours = 0;

        detectedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      } else {
        // 24-hour time format: e.g. "14:30", "09:00", or "at 14:00"
        const timeRegex24 = /\b(?:at\s+)?([01]\d|2[0-3]):([0-5]\d)\b/i;
        const match24 = lower.match(timeRegex24);
        if (match24) {
          detectedTime = `${match24[1]}:${match24[2]}`;
        }
      }
    }

    // 7. Extract Date
    let detectedDate: string | undefined;
    let hasRelativeWeekday = false;
    let hasRelativeOffsetDays: number | undefined;

    // ISO format YYYY-MM-DD
    const isoDateMatch = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (isoDateMatch) {
      detectedDate = isoDateMatch[0];
    }

    // "today"
    if (!detectedDate && /\btoday\b/i.test(lower)) {
      detectedDate = now.toISODate() || undefined;
      hasRelativeOffsetDays = 0;
    }

    // "tomorrow"
    if (!detectedDate && /\btomorrow\b/i.test(lower)) {
      detectedDate = now.plus({ days: 1 }).toISODate() || undefined;
      hasRelativeOffsetDays = 1;
    }

    // "day after tomorrow"
    if (!detectedDate && /\bday after tomorrow\b/i.test(lower)) {
      detectedDate = now.plus({ days: 2 }).toISODate() || undefined;
      hasRelativeOffsetDays = 2;
    }

    // "in N days"
    if (!detectedDate) {
      const inDaysMatch = lower.match(/\bin\s+(\d+)\s+days?\b/i);
      if (inDaysMatch) {
        const offset = parseInt(inDaysMatch[1], 10);
        detectedDate = now.plus({ days: offset }).toISODate() || undefined;
        hasRelativeOffsetDays = offset;
      }
    }

    // Weekday names: e.g. "next monday", "this friday", "on tuesday", "wednesday"
    if (!detectedDate) {
      for (const [dayName, targetDayNum] of Object.entries(WEEKDAY_NAMES)) {
        const regexNext = new RegExp(`\\bnext\\s+${dayName}\\b`, 'i');
        const regexThis = new RegExp(`\\b(?:this\\s+|coming\\s+|on\\s+)?${dayName}\\b`, 'i');

        if (regexNext.test(lower)) {
          hasRelativeWeekday = true;
          // "next Monday" means the Monday of next week
          const currentLuxonDay = now.weekday % 7; // Luxon: Monday=1, Sunday=7 -> convert to Sun=0, Mon=1..Sat=6
          let daysAhead = (targetDayNum - currentLuxonDay + 7) % 7;
          if (daysAhead === 0) daysAhead = 7;
          // Add another 7 if "next" is explicitly intended as next week's occurrence
          const target = now.plus({ days: daysAhead <= 3 ? daysAhead + 7 : daysAhead });
          detectedDate = target.toISODate() || undefined;
          break;
        } else if (regexThis.test(lower)) {
          hasRelativeWeekday = true;
          const currentLuxonDay = now.weekday % 7;
          let daysAhead = (targetDayNum - currentLuxonDay + 7) % 7;
          if (daysAhead === 0) daysAhead = 7; // next occurrence
          const target = now.plus({ days: daysAhead });
          detectedDate = target.toISODate() || undefined;
          break;
        }
      }
    }

    // Month + Day: e.g. "November 15", "Nov 15th", "15 Nov"
    if (!detectedDate) {
      for (const [monthName, monthNum] of Object.entries(MONTH_NAMES)) {
        const monthDayRegex1 = new RegExp(`\\b${monthName}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i');
        const monthDayRegex2 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${monthName}\\b`, 'i');

        const m1 = lower.match(monthDayRegex1);
        const m2 = lower.match(monthDayRegex2);
        const dayStr = m1 ? m1[1] : m2 ? m2[1] : null;

        if (dayStr) {
          const day = parseInt(dayStr, 10);
          let candidate = DateTime.fromObject(
            { year: now.year, month: monthNum, day },
            { zone }
          );
          // If the date in this year has already passed, use next year
          if (candidate < now.startOf('day')) {
            candidate = candidate.plus({ years: 1 });
          }
          if (candidate.isValid) {
            detectedDate = candidate.toISODate() || undefined;
            break;
          }
        }
      }
    }

    // 8. Clean and derive title
    let detectedTitle = rawInput;
    // Strip emails
    detectedTitle = detectedTitle.replace(EMAIL_REGEX, '');
    // Strip common scheduling prefixes
    detectedTitle = detectedTitle.replace(/^(schedule|book|create|set up|plan)\s+(a\s+)?(meeting|call|session|sync)?\s*(for|about|with|on)?/i, '');
    // Strip time tokens
    detectedTitle = detectedTitle.replace(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi, '');
    detectedTitle = detectedTitle.replace(/\b(?:at\s+)?([01]\d|2[0-3]):([0-5]\d)\b/gi, '');
    detectedTitle = detectedTitle.replace(/\b(noon|midnight)\b/gi, '');
    // Strip date tokens
    detectedTitle = detectedTitle.replace(/\b(today|tomorrow|day after tomorrow)\b/gi, '');
    detectedTitle = detectedTitle.replace(/\b(next|this|coming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '');
    detectedTitle = detectedTitle.replace(/\b(every\s+(day|week|month|year|weekdays|mon-fri))\b/gi, '');
    // Strip duration tokens
    detectedTitle = detectedTitle.replace(/\b(?:for\s+)?\d+(?:\.\d+)?\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/gi, '');
    // Strip privacy tokens
    detectedTitle = detectedTitle.replace(/\b(private|confidential|internal|secret|public)\b/gi, '');
    // Strip leftover dangling prepositions at the beginning or end
    detectedTitle = detectedTitle.replace(/^[,\s]*(with|for|at|on|about)\s+/gi, '');
    detectedTitle = detectedTitle.replace(/\s+(with|for|at|on|about)[,\s]*$/gi, '');
    // Strip leftover punctuation and extra whitespace
    detectedTitle = detectedTitle.replace(/[,"'()]/g, ' ').replace(/\s+/g, ' ').trim();

    if (!detectedTitle || detectedTitle.length < 2) {
      detectedTitle = 'Scheduled Meeting';
    } else {
      // Capitalize each word for title
      detectedTitle = detectedTitle
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }

    return {
      detectedTitle,
      detectedDate,
      detectedTime,
      detectedDuration,
      detectedParticipants: participants,
      detectedPrivacy,
      detectedRecurrence,
      hasRelativeWeekday,
      hasRelativeOffsetDays,
    };
  }

  /**
   * Deterministic full-intent synthesis fallback.
   * Produces a fully valid SmartScheduleIntent without calling external AI.
   */
  public static synthesizeDeterministicIntent(
    input: string,
    timezone: string,
    teamsContext: TeamContext[] = [],
    nowReference?: DateTime
  ): SmartScheduleIntent {
    const zone = timezone || 'UTC';
    const now = nowReference || DateTime.now().setZone(zone);
    const signals = this.extractSignals(input, zone, teamsContext, now);

    // Default date to today if none detected
    const date = signals.detectedDate || now.toISODate() || '2026-11-01';

    // Default time: if none detected, snap to next 15-minute slot or +1 hour
    let time = signals.detectedTime;
    if (!time) {
      const isToday = date === now.toISODate();
      if (isToday) {
        // Snap to next 15-minute slot
        const remainder = now.minute % 15;
        const addMinutes = remainder === 0 ? 15 : 15 - remainder;
        const snapped = now.plus({ minutes: addMinutes });
        time = snapped.toFormat('HH:mm');
      } else {
        time = '09:00';
      }
    }

    const duration = signals.detectedDuration || 30;
    const privacy = signals.detectedPrivacy || 'public';
    const participants = signals.detectedParticipants || [];

    const recurrence: RecurrenceSpec = {
      enabled: signals.detectedRecurrence?.enabled || false,
      pattern: signals.detectedRecurrence?.pattern || 'weekly',
      interval: signals.detectedRecurrence?.interval || 1,
      daysOfWeek: signals.detectedRecurrence?.daysOfWeek || [],
      dayOfMonth: signals.detectedRecurrence?.dayOfMonth || null,
      endType: signals.detectedRecurrence?.endType || 'never',
      endDate: signals.detectedRecurrence?.endDate || null,
      occurrences: signals.detectedRecurrence?.occurrences || null,
    };

    // If weekly recurrence enabled without explicit daysOfWeek, auto-populate from date's day of week
    if (recurrence.enabled && recurrence.pattern === 'weekly' && recurrence.daysOfWeek.length === 0) {
      const parsedDt = DateTime.fromISO(date, { zone });
      if (parsedDt.isValid) {
        recurrence.daysOfWeek = [parsedDt.weekday % 7];
      }
    }

    return {
      title: signals.detectedTitle || 'Scheduled Meeting',
      description: `Meeting scheduled via natural language: "${input.slice(0, 100)}"`,
      date,
      time,
      duration,
      timezone: zone,
      privacy,
      participants,
      recurrence,
      confidence: 0.85,
    };
  }
}
