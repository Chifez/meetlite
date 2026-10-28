import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIanaTimeZone,
  parseLocalDate,
  parseLocalTime,
  resolveZonedDateTime,
} from './zoned-date-time.js';

describe('MLTR-01: Zoned Date-Time Primitives & DST Boundary Handling', () => {
  it('resolves standard local date, time, and IANA timezone to exact UTC instant', () => {
    const date = parseLocalDate('2026-06-15');
    const time = parseLocalTime('09:30:00');
    const zone = parseIanaTimeZone('America/New_York');

    const result = resolveZonedDateTime({ date, time, zone });
    assert.strictEqual(result.ok, true, 'Standard resolution should succeed');
    if (!result.ok) return;

    // In June, New York is in EDT (UTC-4), so 09:30 EDT is 13:30 UTC
    assert.strictEqual(result.value.utcInstant.toISOString(), '2026-06-15T13:30:00.000Z');
    assert.strictEqual(result.value.offset, '-04:00');
    assert.strictEqual(result.value.occurrenceKey, '2026-06-15T09:30:00');
  });

  it('rejects nonexistent local time during spring-forward transition with suggestion', () => {
    // On 2026-03-08 in America/New_York, clocks skip 02:00 -> 03:00. 02:30 does not exist.
    const date = parseLocalDate('2026-03-08');
    const time = parseLocalTime('02:30:00');
    const zone = parseIanaTimeZone('America/New_York');

    const result = resolveZonedDateTime({ date, time, zone });
    assert.strictEqual(result.ok, false, 'Nonexistent spring-forward time must fail');
    if (result.ok) return;

    assert.strictEqual(result.error.code, 'INVALID_LOCAL_TIME');
    assert.strictEqual(result.error.suggestedNextValidTime, '03:00:00');
  });

  it('requires explicit disambiguation for ambiguous fall-back local time', () => {
    // On 2026-11-01 in America/New_York, 01:30 repeats (first in EDT UTC-4, then in EST UTC-5)
    const date = parseLocalDate('2026-11-01');
    const time = parseLocalTime('01:30:00');
    const zone = parseIanaTimeZone('America/New_York');

    // Without disambiguation choice, it must be flagged as ambiguous
    const ambiguousResult = resolveZonedDateTime({ date, time, zone });
    assert.strictEqual(ambiguousResult.ok, false, 'Ambiguous fall-back time must require disambiguation');
    if (!ambiguousResult.ok) {
      assert.strictEqual(ambiguousResult.error.code, 'AMBIGUOUS_LOCAL_TIME');
    }

    // With explicit disambiguation: earlier -> EDT (UTC-4) -> 05:30 UTC
    const earlierResult = resolveZonedDateTime({
      date,
      time,
      zone,
      disambiguation: 'earlier',
    });
    assert.strictEqual(earlierResult.ok, true);
    if (earlierResult.ok) {
      assert.strictEqual(earlierResult.value.utcInstant.toISOString(), '2026-11-01T05:30:00.000Z');
      assert.strictEqual(earlierResult.value.offset, '-04:00');
    }

    // With explicit disambiguation: later -> EST (UTC-5) -> 06:30 UTC
    const laterResult = resolveZonedDateTime({
      date,
      time,
      zone,
      disambiguation: 'later',
    });
    assert.strictEqual(laterResult.ok, true);
    if (laterResult.ok) {
      assert.strictEqual(laterResult.value.utcInstant.toISOString(), '2026-11-01T06:30:00.000Z');
      assert.strictEqual(laterResult.value.offset, '-05:00');
    }
  });

  it('rejects invalid or unknown IANA timezones', () => {
    assert.throws(
      () => parseIanaTimeZone('Invalid/Imaginary_Zone'),
      (err: any) => err.code === 'INVALID_TIME_ZONE' || err.message.includes('INVALID_TIME_ZONE')
    );
  });
});
