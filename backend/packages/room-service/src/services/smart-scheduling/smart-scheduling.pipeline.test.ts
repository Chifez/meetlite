import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { DeterministicNlpExtractor } from './deterministic-extractor.js';
import { SmartSchedulingPipeline } from './smart-scheduling.pipeline.js';
import {
  SmartScheduleIntentSchema,
  findOpenAiSchemaViolations,
  TeamContext,
} from './smart-scheduling.schema.js';

describe('Smart Scheduling Pipeline & Gated Loop', () => {
  const referenceNow = DateTime.fromISO('2026-11-01T10:00:00', { zone: 'UTC' }); // Sunday Nov 1, 2026

  const mockTeams: TeamContext[] = [
    {
      id: 'team-dev',
      name: 'Dev Team',
      members: [
        { email: 'dev1@meetlite.test', name: 'Alice Dev' },
        { email: 'dev2@meetlite.test', name: 'Bob Dev' },
      ],
    },
  ];

  describe('DeterministicNlpExtractor', () => {
    it('extracts date, time, duration, emails, and privacy accurately', () => {
      const input = 'Private architecture review tomorrow at 2:30pm for 45 mins with alice@meetlite.test';
      const signals = DeterministicNlpExtractor.extractSignals(
        input,
        'UTC',
        [],
        referenceNow
      );

      assert.equal(signals.detectedPrivacy, 'private');
      assert.equal(signals.detectedDate, '2026-11-02'); // tomorrow is Monday Nov 2
      assert.equal(signals.detectedTime, '14:30');
      assert.equal(signals.detectedDuration, 45);
      assert.deepEqual(signals.detectedParticipants, ['alice@meetlite.test']);
      assert.ok(signals.detectedTitle?.includes('Architecture Review'));
    });

    it('expands team members when team name is mentioned', () => {
      const input = 'Sprint retrospective with the Dev Team next Tuesday at 11am';
      const signals = DeterministicNlpExtractor.extractSignals(
        input,
        'UTC',
        mockTeams,
        referenceNow
      );

      assert.ok(signals.detectedParticipants.includes('dev1@meetlite.test'));
      assert.ok(signals.detectedParticipants.includes('dev2@meetlite.test'));
      assert.equal(signals.detectedTime, '11:00');
    });

    it('extracts complex recurrence rules', () => {
      const input = 'Design sync every Wednesday and Friday at 10am for 1 hour until 2026-12-31';
      const signals = DeterministicNlpExtractor.extractSignals(
        input,
        'UTC',
        [],
        referenceNow
      );

      assert.equal(signals.detectedRecurrence?.enabled, true);
      assert.equal(signals.detectedRecurrence?.pattern, 'weekly');
      assert.deepEqual(signals.detectedRecurrence?.daysOfWeek, [3, 5]); // Wednesday=3, Friday=5
      assert.equal(signals.detectedDuration, 60);
      assert.equal(signals.detectedRecurrence?.endType, 'on');
      assert.equal(signals.detectedRecurrence?.endDate, '2026-12-31');
    });

    it('synthesizes a fully valid SmartScheduleIntent without external AI', () => {
      const input = 'Coffee chat tomorrow at 9am with partner@example.com';
      const intent = DeterministicNlpExtractor.synthesizeDeterministicIntent(
        input,
        'UTC',
        [],
        referenceNow
      );

      const parsed = SmartScheduleIntentSchema.safeParse(intent);
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.date, '2026-11-02');
        assert.equal(parsed.data.time, '09:00');
        assert.deepEqual(parsed.data.participants, ['partner@example.com']);
        assert.equal(parsed.data.duration, 30);
      }
    });
  });

  describe('SmartSchedulingPipeline Gate Execution', () => {
    it('executes deterministic fallback pipeline cleanly when AI is absent', async () => {
      const result = await SmartSchedulingPipeline.process(
        'Sprint Planning next Monday at 14:00 for 90m with lead@test.com',
        'UTC',
        [],
        undefined,
        referenceNow
      );

      assert.equal(result.success, true);
      assert.equal(result.diagnostics.engine, 'deterministic_pipeline');
      assert.equal(result.data.time, '14:00');
      assert.equal(result.data.duration, 90);
      assert.ok(result.data.participants.includes('lead@test.com'));

      // Validate Zod schema conforms
      const schemaCheck = SmartScheduleIntentSchema.safeParse(result.data);
      assert.equal(schemaCheck.success, true);
    });

    it('handles empty input gracefully with safe default slot', async () => {
      const result = await SmartSchedulingPipeline.process(
        '',
        'UTC',
        [],
        undefined,
        referenceNow
      );

      assert.equal(result.success, true);
      assert.equal(result.data.title, 'Scheduled Meeting');
      assert.ok(result.diagnostics.warnings?.length);
    });

    it('enforces past-date protection by advancing to tomorrow if time has elapsed today', async () => {
      // referenceNow is 2026-11-01T10:00:00
      // Requesting 08:00 today means it already passed at 10:00:00
      const result = await SmartSchedulingPipeline.process(
        'Emergency sync today at 8:00am',
        'UTC',
        [],
        undefined,
        referenceNow
      );

      assert.equal(result.success, true);
      // Auto-advanced to tomorrow (2026-11-02)
      assert.equal(result.data.date, '2026-11-02');
      assert.equal(result.data.time, '08:00');
      assert.ok(result.diagnostics.warnings?.some((w) => w.includes('already passed today')));
    });

    it('enforces weekly recurrence day-of-week alignment with start date', async () => {
      const result = await SmartSchedulingPipeline.process(
        'Standup every week on Monday at 10am',
        'UTC',
        [],
        undefined,
        referenceNow
      );

      assert.equal(result.data.recurrence.enabled, true);
      assert.equal(result.data.recurrence.pattern, 'weekly');
      assert.ok(result.data.recurrence.daysOfWeek.includes(1)); // Monday
    });
  });

  describe('OpenAI Schema Guard', () => {
    it('detects missing required fields in schema according to OpenAI rules', () => {
      const invalidSchema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['title'], // missing 'date'
      };

      const violations = findOpenAiSchemaViolations(invalidSchema);
      assert.equal(violations.length, 1);
      assert.ok(violations[0].includes("missing 'date' in required"));
    });

    it('passes when all properties are present in required array', () => {
      const validSchema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['title', 'date'],
      };

      const violations = findOpenAiSchemaViolations(validSchema);
      assert.equal(violations.length, 0);
    });
  });

  describe('Conflict Analysis Gate', () => {
    it('generates conflict alternatives when overlapping meeting exists', async () => {
      const mockPrisma = {
        meeting: {
          findMany: async () => [
            {
              id: 'conflicting-1',
              title: 'Existing Standup',
              startTime: new Date('2026-11-02T14:00:00Z'),
              endTime: new Date('2026-11-02T15:00:00Z'),
            },
          ],
        },
      };

      const intent = DeterministicNlpExtractor.synthesizeDeterministicIntent(
        'Product review tomorrow at 14:00 for 30m',
        'UTC',
        [],
        referenceNow
      );

      const conflicts = await SmartSchedulingPipeline.performConflictCheck(
        intent,
        mockPrisma,
        'user-123'
      );

      assert.equal(conflicts.isAvailable, false);
      assert.equal(conflicts.conflicts.length, 1);
      assert.ok(conflicts.alternatives.length >= 3);
      assert.equal(conflicts.alternatives[0].reason, 'After current conflict');
    });
  });
});

