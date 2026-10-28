import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RRuleRecurrenceEngine } from './rrule-recurrence-engine.js';
import { parseLocalDate, parseLocalTime, parseIanaTimeZone } from '../time/zoned-date-time.js';

describe('MLTR-01: RRuleRecurrenceEngine Zoned Wall-Clock Preservation & Invariants', () => {
  const engine = new RRuleRecurrenceEngine();

  it('preserves local wall-clock time across DST boundary (America/New_York)', () => {
    // Weekly Sunday at 09:00:00 starting on 2026-03-01 in America/New_York
    const validated = engine.validate({
      localDate: parseLocalDate('2026-03-01'),
      localTime: parseLocalTime('09:00:00'),
      timeZone: parseIanaTimeZone('America/New_York'),
      spec: {
        frequency: 'weekly',
        interval: 1,
        weekdays: [0], // Sunday
        end: { type: 'count', count: 3 },
      },
    });

    assert.strictEqual(validated.ok, true);
    if (!validated.ok) return;

    const seeds = engine.preview(validated.value, 3);
    assert.strictEqual(seeds.length, 3, 'Expected 3 seeds');

    // 1. March 1: EST (UTC-5) -> 09:00 EST is 14:00 UTC
    assert.strictEqual(seeds[0].occurrenceKey, '2026-03-01T09:00:00');
    assert.strictEqual(seeds[0].scheduledAt.toISOString(), '2026-03-01T14:00:00.000Z');
    assert.strictEqual(seeds[0].offset, '-05:00');

    // 2. March 8: After US DST starts! EDT (UTC-4) -> 09:00 EDT is 13:00 UTC!
    // Wall-clock time remains 09:00 AM! No drift to 10:00 AM!
    assert.strictEqual(seeds[1].occurrenceKey, '2026-03-08T09:00:00');
    assert.strictEqual(seeds[1].scheduledAt.toISOString(), '2026-03-08T13:00:00.000Z');
    assert.strictEqual(seeds[1].offset, '-04:00');

    // 3. March 15: EDT (UTC-4) -> 09:00 EDT is 13:00 UTC
    assert.strictEqual(seeds[2].occurrenceKey, '2026-03-15T09:00:00');
    assert.strictEqual(seeds[2].scheduledAt.toISOString(), '2026-03-15T13:00:00.000Z');
    assert.strictEqual(seeds[2].offset, '-04:00');
  });

  it('enforces RFC rule: COUNT includes first occurrence', () => {
    const validated = engine.validate({
      localDate: parseLocalDate('2026-04-01'),
      localTime: parseLocalTime('10:00:00'),
      timeZone: parseIanaTimeZone('UTC'),
      spec: {
        frequency: 'daily',
        interval: 1,
        end: { type: 'count', count: 3 },
      },
    });

    assert.strictEqual(validated.ok, true);
    if (!validated.ok) return;

    const seeds = engine.preview(validated.value, 10);
    assert.strictEqual(seeds.length, 3, 'COUNT=3 must produce exactly 3 occurrences including initial');
    assert.strictEqual(seeds[0].occurrenceKey, '2026-04-01T10:00:00');
    assert.strictEqual(seeds[1].occurrenceKey, '2026-04-02T10:00:00');
    assert.strictEqual(seeds[2].occurrenceKey, '2026-04-03T10:00:00');
  });

  it('skips months lacking day 31 (RFC monthly-by-date behavior)', () => {
    // Starting on January 31, 2026
    const validated = engine.validate({
      localDate: parseLocalDate('2026-01-31'),
      localTime: parseLocalTime('15:00:00'),
      timeZone: parseIanaTimeZone('UTC'),
      spec: {
        frequency: 'monthlyByDate',
        interval: 1,
        dayOfMonth: 31,
        end: { type: 'count', count: 3 },
      },
    });

    assert.strictEqual(validated.ok, true);
    if (!validated.ok) return;

    const seeds = engine.preview(validated.value, 3);
    assert.strictEqual(seeds.length, 3);
    // Jan 31 -> February has no 31 (skipped) -> March 31 -> April has no 31 (skipped) -> May 31
    assert.strictEqual(seeds[0].occurrenceKey, '2026-01-31T15:00:00');
    assert.strictEqual(seeds[1].occurrenceKey, '2026-03-31T15:00:00');
    assert.strictEqual(seeds[2].occurrenceKey, '2026-05-31T15:00:00');
  });

  it('skips non-leap years for February 29 yearly recurrence', () => {
    // 2028 is a leap year (Feb 29 exists). 2029, 2030, 2031 are not. 2032 is a leap year.
    const validated = engine.validate({
      localDate: parseLocalDate('2028-02-29'),
      localTime: parseLocalTime('11:00:00'),
      timeZone: parseIanaTimeZone('UTC'),
      spec: {
        frequency: 'yearlyByDate',
        interval: 1,
        end: { type: 'count', count: 2 },
      },
    });

    assert.strictEqual(validated.ok, true);
    if (!validated.ok) return;

    const seeds = engine.preview(validated.value, 2);
    assert.strictEqual(seeds.length, 2);
    assert.strictEqual(seeds[0].occurrenceKey, '2028-02-29T11:00:00');
    assert.strictEqual(seeds[1].occurrenceKey, '2032-02-29T11:00:00');
  });

  it('respects inclusive UNTIL end conditions in the event timezone', () => {
    const validated = engine.validate({
      localDate: parseLocalDate('2026-05-01'),
      localTime: parseLocalTime('14:00:00'),
      timeZone: parseIanaTimeZone('Europe/London'),
      spec: {
        frequency: 'daily',
        interval: 1,
        end: { type: 'until', localDate: parseLocalDate('2026-05-03') },
      },
    });

    assert.strictEqual(validated.ok, true);
    if (!validated.ok) return;

    const seeds = engine.preview(validated.value, 10);
    // May 1, May 2, May 3 (inclusive)
    assert.strictEqual(seeds.length, 3);
    assert.strictEqual(seeds[2].occurrenceKey, '2026-05-03T14:00:00');
  });
});
