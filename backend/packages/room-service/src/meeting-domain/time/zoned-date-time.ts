import { DateTime, IANAZone } from 'luxon';

export type LocalDate = string & { readonly __brand: 'LocalDate' };
export type LocalTime = string & { readonly __brand: 'LocalTime' };
export type IanaTimeZone = string & { readonly __brand: 'IanaTimeZone' };

export interface ZonedDateTimeValue {
  utcInstant: Date;
  offset: string; // e.g. "-04:00" or "+01:00"
  occurrenceKey: string; // YYYY-MM-DDTHH:mm:ss
  timeZone: IanaTimeZone;
  localDate: LocalDate;
  localTime: LocalTime;
}

export type ZonedDateTimeErrorCode =
  | 'INVALID_LOCAL_DATE'
  | 'INVALID_LOCAL_TIME'
  | 'INVALID_TIME_ZONE'
  | 'AMBIGUOUS_LOCAL_TIME';

export interface ZonedDateTimeError {
  code: ZonedDateTimeErrorCode;
  message: string;
  suggestedNextValidTime?: string;
}

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface ResolveZonedOptions {
  date: LocalDate;
  time: LocalTime;
  zone: IanaTimeZone;
  disambiguation?: 'earlier' | 'later';
}

/**
 * Validate and brand a LocalDate (YYYY-MM-DD)
 */
export function parseLocalDate(raw: string): LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const error: any = new Error(`Invalid local date format (expected YYYY-MM-DD): "${raw}"`);
    error.code = 'INVALID_LOCAL_DATE';
    throw error;
  }
  const dt = DateTime.fromISO(raw, { zone: 'utc' });
  if (!dt.isValid) {
    const error: any = new Error(`Invalid calendar date: "${raw}"`);
    error.code = 'INVALID_LOCAL_DATE';
    throw error;
  }
  return raw as LocalDate;
}

/**
 * Validate and brand a LocalTime (HH:mm or HH:mm:ss)
 */
export function parseLocalTime(raw: string): LocalTime {
  const normalized = raw.length === 5 ? `${raw}:00` : raw;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    const error: any = new Error(`Invalid local time format (expected HH:mm or HH:mm:ss): "${raw}"`);
    error.code = 'INVALID_LOCAL_TIME';
    throw error;
  }
  const [h, m, s] = normalized.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) {
    const error: any = new Error(`Invalid time values: "${raw}"`);
    error.code = 'INVALID_LOCAL_TIME';
    throw error;
  }
  return normalized as LocalTime;
}

/**
 * Validate and brand an IANA timezone
 */
export function parseIanaTimeZone(raw: string): IanaTimeZone {
  if (!raw || typeof raw !== 'string') {
    const error: any = new Error(`Invalid timezone: empty or not a string`);
    error.code = 'INVALID_TIME_ZONE';
    throw error;
  }

  if (!IANAZone.isValidZone(raw)) {
    const error: any = new Error(`Unknown or invalid IANA timezone: "${raw}"`);
    error.code = 'INVALID_TIME_ZONE';
    throw error;
  }

  return raw as IanaTimeZone;
}

/**
 * Check if a local date-time falls in a spring-forward gap (nonexistent time)
 * or fall-back overlap (ambiguous time).
 */
export function resolveZonedDateTime(
  options: ResolveZonedOptions
): Result<ZonedDateTimeValue, ZonedDateTimeError> {
  const { date, time, zone, disambiguation } = options;

  const isoLocal = `${date}T${time}`;
  const dtDefault = DateTime.fromISO(isoLocal, { zone });

  if (!dtDefault.isValid) {
    return {
      ok: false,
      error: {
        code: 'INVALID_LOCAL_TIME',
        message: `Invalid local time in timezone ${zone}: ${dtDefault.invalidReason}`,
      },
    };
  }

  // 1. Check for Spring-Forward Gap (Nonexistent Local Time)
  // When a time does not exist (e.g. 02:30 during +1h skip), Luxon shifts the hour.
  // We detect this by round-tripping the local time string.
  const roundTripTime = dtDefault.toFormat('HH:mm:ss');
  if (roundTripTime !== time) {
    // Clocks skipped forward. Find the next valid time (typically the jump boundary, e.g. 03:00:00)
    const suggestedNext = dtDefault.startOf('hour').toFormat('HH:mm:ss');
    return {
      ok: false,
      error: {
        code: 'INVALID_LOCAL_TIME',
        message: `Local time ${time} does not exist on ${date} in ${zone} due to Daylight Saving Time transition.`,
        suggestedNextValidTime: suggestedNext,
      },
    };
  }

  // 2. Check for Fall-Back Overlap (Ambiguous Local Time)
  // During fall-back, the same wall-clock time occurs twice (once in DST, once in Standard Time).
  // We can probe 1 hour earlier and 1 hour later in UTC to see if both map back to the same local time.
  const oneHourEarlierUtc = dtDefault.minus({ hours: 1 });
  const oneHourLaterUtc = dtDefault.plus({ hours: 1 });

  const earlierZoneDt = oneHourEarlierUtc.setZone(zone);
  const laterZoneDt = oneHourLaterUtc.setZone(zone);

  const hasOffsetShift = earlierZoneDt.offset !== laterZoneDt.offset;
  let isAmbiguous = false;

  if (hasOffsetShift) {
    // Test if this specific time is inside the repeated window
    const dtTestEarlier = DateTime.fromISO(isoLocal, { zone }).set({
      hour: Number(time.split(':')[0]),
      minute: Number(time.split(':')[1]),
      second: Number(time.split(':')[2]),
    });
    // Check if moving backwards across the boundary can land on the same local time
    const test1 = DateTime.fromMillis(dtDefault.toMillis() - 3600000, { zone });
    const test2 = DateTime.fromMillis(dtDefault.toMillis() + 3600000, { zone });

    if (test1.offset !== test2.offset) {
      // Re-create with earlier offset (EDT) and later offset (EST)
      const dtEarlier = DateTime.fromMillis(dtDefault.toMillis() - 3600000, { zone });
      const dtLater = DateTime.fromMillis(dtDefault.toMillis(), { zone });
      if (dtEarlier.toFormat('HH:mm:ss') === time || dtLater.toFormat('HH:mm:ss') === time) {
        // Confirm there are 2 valid UTC instants that format to the exact same local time in this zone
        const utcCandidate1 = dtDefault.toMillis();
        const utcCandidate2 = dtDefault.toMillis() + (test2.offset - test1.offset) * 60000;
        const check1 = DateTime.fromMillis(utcCandidate1, { zone }).toFormat('HH:mm:ss');
        const check2 = DateTime.fromMillis(utcCandidate2, { zone }).toFormat('HH:mm:ss');
        if (check1 === check2 && check1 === time) {
          isAmbiguous = true;
        }
      }
    }
  }

  // A cleaner, standard check for ambiguity:
  // In Luxon, if dt.offset differs between minus 1ms and plus 1ms for the same local window
  // Let's test standard ambiguity:
  const offsetDiffMinutes = earlierZoneDt.offset - laterZoneDt.offset;
  let candidateEarlier = dtDefault;
  let candidateLater = dtDefault;

  if (offsetDiffMinutes > 0) {
    const testEarlier = DateTime.fromMillis(dtDefault.toMillis() - offsetDiffMinutes * 60000, { zone });
    if (testEarlier.isValid && testEarlier.toFormat('HH:mm:ss') === time && dtDefault.toFormat('HH:mm:ss') === time) {
      isAmbiguous = true;
      candidateEarlier = testEarlier;
      candidateLater = dtDefault;
    }
  }

  if (isAmbiguous) {
    if (!disambiguation) {
      return {
        ok: false,
        error: {
          code: 'AMBIGUOUS_LOCAL_TIME',
          message: `Local time ${time} is ambiguous on ${date} in ${zone} (occurs twice due to DST fall-back). Explicit disambiguation ('earlier' or 'later') is required.`,
        },
      };
    }

    const resolvedDt = disambiguation === 'earlier' ? candidateEarlier : candidateLater;

    return {
      ok: true,
      value: {
        utcInstant: resolvedDt.toJSDate(),
        offset: resolvedDt.toFormat('ZZ'),
        occurrenceKey: `${date}T${time}`,
        timeZone: zone,
        localDate: date,
        localTime: time,
      },
    };
  }

  return {
    ok: true,
    value: {
      utcInstant: dtDefault.toJSDate(),
      offset: dtDefault.toFormat('ZZ'),
      occurrenceKey: `${date}T${time}`,
      timeZone: zone,
      localDate: date,
      localTime: time,
    },
  };
}

/**
 * Format stable occurrence key YYYY-MM-DDTHH:mm:ss
 */
export function formatZonedKey(date: LocalDate, time: LocalTime): string {
  const normTime = time.length === 5 ? `${time}:00` : time;
  return `${date}T${normTime}`;
}

