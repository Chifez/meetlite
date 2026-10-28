import pkg from 'rrule';
import { DateTime } from 'luxon';
import {
  RecurrenceDefinition,
  ValidatedRecurrence,
  OccurrenceSeed,
  ExpansionWindow,
  RecurrenceError,
} from './recurrence-types.js';
import {
  parseLocalDate,
  parseLocalTime,
  resolveZonedDateTime,
  Result,
} from '../time/zoned-date-time.js';

const { RRule, rrulestr } = pkg;

export interface RecurrenceEngine {
  validate(input: RecurrenceDefinition): Result<ValidatedRecurrence, RecurrenceError>;
  preview(input: ValidatedRecurrence, limit?: number): readonly OccurrenceSeed[];
  expand(
    input: ValidatedRecurrence,
    window: ExpansionWindow
  ): readonly OccurrenceSeed[];
}

export class RRuleRecurrenceEngine implements RecurrenceEngine {
  /**
   * Validate and construct an RFC-compliant recurrence rule
   */
  validate(
    input: RecurrenceDefinition
  ): Result<ValidatedRecurrence, RecurrenceError> {
    const { localDate, localTime, timeZone, spec } = input;

    // Validate initial date & time resolution in the event timezone
    const initialZoned = resolveZonedDateTime({
      date: localDate,
      time: localTime,
      zone: timeZone,
      disambiguation: 'earlier',
    });

    if (!initialZoned.ok) {
      return {
        ok: false,
        error: {
          code: 'INVALID_RECURRENCE_SPEC',
          message: initialZoned.error.message,
        },
      };
    }

    // Interval checks
    if ('interval' in spec && (typeof spec.interval !== 'number' || spec.interval < 1)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_INTERVAL',
          message: 'Recurrence interval must be a positive integer >= 1',
        },
      };
    }

    // End condition checks
    if (spec.end.type === 'count') {
      if (typeof spec.end.count !== 'number' || spec.end.count < 1) {
        return {
          ok: false,
          error: {
            code: 'INVALID_COUNT',
            message: 'Recurrence count must be a positive integer >= 1',
          },
        };
      }
    } else if (spec.end.type === 'until') {
      if (spec.end.localDate < localDate) {
        return {
          ok: false,
          error: {
            code: 'INVALID_UNTIL_DATE',
            message: 'Recurrence until date cannot be earlier than start date',
          },
        };
      }
    }

    // Frequency specific checks
    if (spec.frequency === 'weekly') {
      if (!Array.isArray(spec.weekdays) || spec.weekdays.length === 0) {
        return {
          ok: false,
          error: {
            code: 'INVALID_WEEKDAYS',
            message: 'Weekly recurrence requires at least one weekday (0-6)',
          },
        };
      }
      for (const day of spec.weekdays) {
        if (!Number.isInteger(day) || day < 0 || day > 6) {
          return {
            ok: false,
            error: {
              code: 'INVALID_WEEKDAYS',
              message: `Invalid weekday index ${day}. Must be between 0 (Sun) and 6 (Sat)`,
            },
          };
        }
      }
    } else if (spec.frequency === 'monthlyByDate') {
      if (
        typeof spec.dayOfMonth !== 'number' ||
        spec.dayOfMonth < 1 ||
        spec.dayOfMonth > 31
      ) {
        return {
          ok: false,
          error: {
            code: 'INVALID_DAY_OF_MONTH',
            message: 'Monthly by date requires dayOfMonth between 1 and 31',
          },
        };
      }
    }

    const rruleString = this.buildRRuleString(input);

    return {
      ok: true,
      value: {
        localDate,
        localTime,
        timeZone,
        spec,
        rruleString,
      },
    };
  }

  /**
   * Preview the first N occurrences (defaults to 5)
   */
  preview(
    input: ValidatedRecurrence,
    limit = 5
  ): readonly OccurrenceSeed[] {
    const fromInclusive = new Date(0); // from epoch
    const toExclusive = new Date(Date.now() + 50 * 365 * 86400000); // 50 years ahead
    return this.expand(input, { fromInclusive, toExclusive, limit });
  }

  /**
   * Expand occurrences within a bounded window
   */
  expand(
    input: ValidatedRecurrence,
    window: ExpansionWindow
  ): readonly OccurrenceSeed[] {
    const { rruleString, timeZone, localTime, localDate } = input;
    const [y, m, d] = localDate.split('-').map(Number);
    const [hh, mm, ss] = localTime.split(':').map(Number);
    const defaultDtstart = new Date(Date.UTC(y, m - 1, d, hh, mm, ss || 0));
    const rule = rrulestr(rruleString, { dtstart: defaultDtstart });

    // Expand local dates between bounds
    // Note: RRule evaluates dates naively according to the constructed DTSTART
    const naiveDates = rule.between(
      this.toNaiveDate(window.fromInclusive, timeZone),
      this.toNaiveDate(window.toExclusive, timeZone),
      true
    );

    const limitedDates = naiveDates.slice(0, window.limit);
    const seeds: OccurrenceSeed[] = [];

    for (const naiveDate of limitedDates) {
      // Extract the local calendar date YYYY-MM-DD
      const year = naiveDate.getFullYear();
      const month = String(naiveDate.getMonth() + 1).padStart(2, '0');
      const day = String(naiveDate.getDate()).padStart(2, '0');
      const dateStr = parseLocalDate(`${year}-${month}-${day}`);

      const zonedResult = resolveZonedDateTime({
        date: dateStr,
        time: localTime,
        zone: timeZone,
        disambiguation: 'earlier',
      });

      if (zonedResult.ok) {
        const { utcInstant, offset, occurrenceKey } = zonedResult.value;
        // Verify this instant falls within the UTC window
        if (utcInstant >= window.fromInclusive && utcInstant < window.toExclusive) {
          seeds.push({
            occurrenceKey,
            localStart: `${occurrenceKey}${offset}`,
            scheduledAt: utcInstant,
            offset,
          });
        }
      }
    }

    return seeds;
  }

  /**
   * Build an RFC 5545 RRULE string using local naive start time
   */
  private buildRRuleString(input: RecurrenceDefinition): string {
    const { localDate, localTime, spec } = input;
    const [y, m, d] = localDate.split('-').map(Number);
    const [hh, mm, ss] = localTime.split(':').map(Number);

    // Create a local naive Date representation
    const dtstart = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));

    const options: any = {
      dtstart,
      interval: 'interval' in spec ? spec.interval : 1,
    };

    switch (spec.frequency) {
      case 'daily':
        options.freq = RRule.DAILY;
        break;

      case 'weekdays':
        options.freq = RRule.DAILY;
        options.byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
        break;

      case 'weekly':
        options.freq = RRule.WEEKLY;
        const dayMap = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
        options.byweekday = spec.weekdays.map((idx) => dayMap[idx]);
        break;

      case 'monthlyByDate':
        options.freq = RRule.MONTHLY;
        options.bymonthday = [spec.dayOfMonth];
        break;

      case 'yearlyByDate':
        options.freq = RRule.YEARLY;
        break;
    }

    if (spec.end.type === 'count') {
      options.count = spec.end.count;
    } else if (spec.end.type === 'until') {
      const [uy, um, ud] = spec.end.localDate.split('-').map(Number);
      // UNTIL is inclusive through end of day
      options.until = new Date(Date.UTC(uy, um - 1, ud, 23, 59, 59));
    }

    const rrule = new RRule(options);
    return rrule.toString();
  }

  private toNaiveDate(utcDate: Date, timeZone: string): Date {
    const dt = DateTime.fromJSDate(utcDate, { zone: timeZone });
    return new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second));
  }
}
