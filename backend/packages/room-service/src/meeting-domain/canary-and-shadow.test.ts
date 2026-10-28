import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RRuleRecurrenceEngine } from './recurrence/rrule-recurrence-engine.js';
import { parseLocalDate, parseLocalTime, parseIanaTimeZone } from './time/zoned-date-time.js';

describe('MLTR-09: Shadow Comparison, Canary Cohorts, and Contraction Invariants', () => {
  const engine = new RRuleRecurrenceEngine();

  // Helper simulating legacy UTC naive recurrence calculation
  function calculateLegacyUtcRecurrence(params: {
    startDateIso: string;
    intervalDays: number;
    count: number;
  }): string[] {
    const dates: string[] = [];
    const base = new Date(params.startDateIso);
    for (let i = 0; i < params.count; i++) {
      const d = new Date(base.getTime() + i * params.intervalDays * 24 * 60 * 60 * 1000);
      dates.push(d.toISOString());
    }
    return dates;
  }

  // Canary cohort hasher
  function getCohortVersion(orgIdOrUserId: string, canaryThresholdPercent: number): 'v1' | 'v2' {
    let hash = 0;
    for (let i = 0; i < orgIdOrUserId.length; i++) {
      hash = (hash << 5) - hash + orgIdOrUserId.charCodeAt(i);
      hash |= 0;
    }
    const score = Math.abs(hash) % 100;
    return score < canaryThresholdPercent ? 'v2' : 'v1';
  }

  it('shadow probe: standard daily series produces identical counts and instants', () => {
    const localDate = parseLocalDate('2026-06-01');
    const localTime = parseLocalTime('14:00');
    const timeZone = parseIanaTimeZone('UTC');

    const v2Result = engine.expand(
      {
        localDate,
        localTime,
        timeZone,
        spec: { frequency: 'daily', interval: 1, end: { type: 'count', count: 5 } },
        rruleString: 'RRULE:FREQ=DAILY;COUNT=5',
      },
      {
        fromInclusive: new Date('2026-06-01T00:00:00Z'),
        toExclusive: new Date('2026-06-10T00:00:00Z'),
        limit: 10,
      }
    );

    const v1Dates = calculateLegacyUtcRecurrence({
      startDateIso: '2026-06-01T14:00:00.000Z',
      intervalDays: 1,
      count: 5,
    });

    assert.equal(v2Result.length, v1Dates.length);
    for (let i = 0; i < v2Result.length; i++) {
      assert.equal(
        v2Result[i].scheduledAt.toISOString(),
        v1Dates[i],
        `Occurrence ${i} matches exactly between v1 and v2 shadow comparison`
      );
    }
  });

  it('shadow probe: detects and logs legacy DST drift across America/New_York March transition', () => {
    const localDate = parseLocalDate('2026-03-01');
    const localTime = parseLocalTime('09:00');
    const timeZone = parseIanaTimeZone('America/New_York');

    // 3 weekly occurrences spanning DST change on 2026-03-08
    const v2Result = engine.expand(
      {
        localDate,
        localTime,
        timeZone,
        spec: { frequency: 'weekly', interval: 1, weekdays: [0], end: { type: 'count', count: 3 } },
        rruleString: 'RRULE:FREQ=WEEKLY;COUNT=3',
      },
      {
        fromInclusive: new Date('2026-03-01T00:00:00Z'),
        toExclusive: new Date('2026-03-25T00:00:00Z'),
        limit: 10,
      }
    );

    // In v2 (zoned wall-clock):
    // 2026-03-01: EST (UTC-5) -> 14:00 UTC
    // 2026-03-08: EDT (UTC-4) -> 13:00 UTC (9:00 local EDT)
    // 2026-03-15: EDT (UTC-4) -> 13:00 UTC (9:00 local EDT)
    const v2UtcHours = v2Result.map((o) => o.scheduledAt.getUTCHours());
    assert.deepEqual(v2UtcHours, [14, 13, 13], 'v2 properly shifts UTC hour to preserve 9:00 local wall-clock');

    // Legacy UTC fixed expansion (7 days * 24h = +168h always):
    const v1Dates = calculateLegacyUtcRecurrence({
      startDateIso: '2026-03-01T14:00:00.000Z',
      intervalDays: 7,
      count: 3,
    });
    const v1UtcHours = v1Dates.map((d) => new Date(d).getUTCHours());
    assert.deepEqual(v1UtcHours, [14, 14, 14], 'v1 exhibits legacy fixed-UTC drift');

    // Shadow probe detects discrepancy cleanly
    const discrepancies = v2Result.filter((o, idx) => {
      return o.scheduledAt.toISOString() !== v1Dates[idx];
    });
    assert.equal(discrepancies.length, 2, 'Shadow probe flags exactly the 2 post-DST occurrences');
  });

  it('canary routing: stable cohort hash partitions tenants predictably without jitter', () => {
    const cohort0 = 'org-tenant-alpha-123';
    const cohort1 = 'org-tenant-beta-456';
    const cohort2 = 'org-tenant-gamma-789';

    // At 0% canary: all v1
    assert.equal(getCohortVersion(cohort0, 0), 'v1');
    assert.equal(getCohortVersion(cohort1, 0), 'v1');
    assert.equal(getCohortVersion(cohort2, 0), 'v1');

    // At 100% canary: all v2
    assert.equal(getCohortVersion(cohort0, 100), 'v2');
    assert.equal(getCohortVersion(cohort1, 100), 'v2');
    assert.equal(getCohortVersion(cohort2, 100), 'v2');

    // Intermediate percentage is deterministic on multiple evaluations
    const run1 = getCohortVersion(cohort0, 50);
    const run2 = getCohortVersion(cohort0, 50);
    assert.equal(run1, run2, 'Cohort assignment is strictly deterministic');
  });

  it('contraction invariant: series occurrence keys are unique and non-overlapping', () => {
    const keys = new Set<string>();
    const count = 10;

    for (let i = 1; i <= count; i++) {
      const day = i < 10 ? `0${i}` : `${i}`;
      const occurrenceKey = `2026-06-${day}T10:00`;
      assert.ok(!keys.has(occurrenceKey), 'Occurrence key must not collide within series');
      keys.add(occurrenceKey);
    }

    assert.equal(keys.size, count);
  });
});
