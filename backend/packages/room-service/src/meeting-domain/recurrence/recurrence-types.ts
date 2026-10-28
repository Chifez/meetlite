import { LocalDate, LocalTime, IanaTimeZone } from '../time/zoned-date-time.js';

export type EndCondition =
  | { type: 'never' }
  | { type: 'count'; count: number }
  | { type: 'until'; localDate: LocalDate };

export type RecurrenceFrequency =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthlyByDate'
  | 'yearlyByDate';

export type RecurrenceSpec =
  | { frequency: 'daily'; interval: number; end: EndCondition }
  | { frequency: 'weekdays'; end: EndCondition }
  | {
      frequency: 'weekly';
      interval: number;
      weekdays: readonly number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
      end: EndCondition;
    }
  | {
      frequency: 'monthlyByDate';
      interval: number;
      dayOfMonth: number;
      end: EndCondition;
    }
  | { frequency: 'yearlyByDate'; interval: number; end: EndCondition };

export interface RecurrenceDefinition {
  localDate: LocalDate;
  localTime: LocalTime;
  timeZone: IanaTimeZone;
  spec: RecurrenceSpec;
}

export interface ValidatedRecurrence {
  localDate: LocalDate;
  localTime: LocalTime;
  timeZone: IanaTimeZone;
  spec: RecurrenceSpec;
  rruleString: string;
}

export interface OccurrenceSeed {
  occurrenceKey: string; // e.g. "2026-03-08T09:00:00"
  localStart: string; // e.g. "2026-03-08T09:00:00-04:00"
  scheduledAt: Date; // UTC instant
  offset: string; // e.g. "-04:00"
}

export interface ExpansionWindow {
  fromInclusive: Date;
  toExclusive: Date;
  limit: number;
}

export type RecurrenceErrorCode =
  | 'INVALID_RECURRENCE_SPEC'
  | 'INVALID_INTERVAL'
  | 'INVALID_COUNT'
  | 'INVALID_UNTIL_DATE'
  | 'INVALID_DAY_OF_MONTH'
  | 'INVALID_WEEKDAYS'
  | 'RECURRENCE_EXPANSION_LIMIT';

export interface RecurrenceError {
  code: RecurrenceErrorCode;
  message: string;
}
