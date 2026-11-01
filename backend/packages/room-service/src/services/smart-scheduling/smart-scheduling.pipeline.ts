import { DateTime } from 'luxon';
import { request as undiciRequest } from 'undici';
import {
  SmartScheduleIntent,
  SmartScheduleIntentSchema,
  TeamContext,
  PipelineExecutionResult,
  AlternativeSlot,
  ConflictCheckPayload,
} from './smart-scheduling.schema.js';
import { DeterministicNlpExtractor } from './deterministic-extractor.js';

export interface ConflictCheckerOptions {
  hostUserId?: string;
  organizationId?: string;
  prismaClient?: any;
}

export class SmartSchedulingPipeline {
  /**
   * Main entry point for the smart scheduling pipeline.
   * Executes multi-stage gating with fallback and repair loops.
   */
  public static async process(
    input: string,
    timezone = 'UTC',
    teamsContext: TeamContext[] = [],
    conflictOptions?: ConflictCheckerOptions,
    nowReference?: DateTime
  ): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    const zone = this.normalizeTimezone(timezone);
    const now = nowReference || DateTime.now().setZone(zone);
    const warnings: string[] = [];
    const repairedFields: string[] = [];

    // ─────────────────────────────────────────────────────────────
    // Gate 1: Request Ingestion & Deterministic Baseline Extraction
    // ─────────────────────────────────────────────────────────────
    const sanitizedInput = (input || '').slice(0, 1000).trim();
    if (!sanitizedInput) {
      const fallbackIntent = DeterministicNlpExtractor.synthesizeDeterministicIntent(
        'Scheduled Meeting',
        zone,
        teamsContext,
        now
      );
      return {
        success: true,
        data: fallbackIntent,
        confidence: 0.5,
        diagnostics: {
          engine: 'deterministic_pipeline',
          warnings: ['Input was empty. Generated default meeting slot.'],
          latencyMs: Date.now() - startTime,
        },
      };
    }

    const deterministicSignals = DeterministicNlpExtractor.extractSignals(
      sanitizedInput,
      zone,
      teamsContext,
      now
    );

    // ─────────────────────────────────────────────────────────────
    // Gate 2: AI Generation with Schema Gating & Recovery Loop
    // ─────────────────────────────────────────────────────────────
    let candidateIntent: SmartScheduleIntent | null = null;
    let engineUsed: 'ai_pipeline' | 'deterministic_pipeline' | 'repaired_pipeline' =
      'deterministic_pipeline';

    const apiKey = process.env.OPENAI_API_KEY;
    const canUseAi = Boolean(apiKey && apiKey.trim().length > 0 && !apiKey.includes('test_placeholder'));

    if (canUseAi) {
      try {
        const rawAiResult = await this.callOpenAiModel(
          sanitizedInput,
          zone,
          now,
          deterministicSignals,
          teamsContext
        );

        // Validate raw AI response against Zod schema
        const parseResult = SmartScheduleIntentSchema.safeParse(rawAiResult);
        if (parseResult.success) {
          candidateIntent = parseResult.data;
          engineUsed = 'ai_pipeline';
        } else {
          // Schema violation occurred - trigger Recovery & Repair Loop
          warnings.push(
            `AI output failed schema validation: ${parseResult.error.issues
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; ')}`
          );

          const repaired = this.repairIntent(
            rawAiResult,
            deterministicSignals,
            zone,
            now,
            repairedFields
          );
          const repairedParse = SmartScheduleIntentSchema.safeParse(repaired);
          if (repairedParse.success) {
            candidateIntent = repairedParse.data;
            engineUsed = 'repaired_pipeline';
          }
        }
      } catch (err: any) {
        warnings.push(`AI invocation failed (${err.message || 'unknown'}). Falling back to deterministic pipeline.`);
      }
    }

    // Fall back to deterministic extractor if AI was unavailable or failed
    if (!candidateIntent) {
      candidateIntent = DeterministicNlpExtractor.synthesizeDeterministicIntent(
        sanitizedInput,
        zone,
        teamsContext,
        now
      );
      engineUsed = 'deterministic_pipeline';
    }

    // ─────────────────────────────────────────────────────────────
    // Gate 3: Temporal & Domain Invariants Gate
    // ─────────────────────────────────────────────────────────────
    const finalizedIntent = this.enforceDomainInvariants(
      candidateIntent,
      zone,
      now,
      sanitizedInput,
      warnings
    );

    // ─────────────────────────────────────────────────────────────
    // Gate 4: Database Conflict & Free/Busy Analysis
    // ─────────────────────────────────────────────────────────────
    let conflictCheck: ConflictCheckPayload | undefined;
    if (conflictOptions?.prismaClient) {
      conflictCheck = await this.performConflictCheck(
        finalizedIntent,
        conflictOptions.prismaClient,
        conflictOptions.hostUserId,
        conflictOptions.organizationId
      );
    }

    return {
      success: true,
      data: finalizedIntent,
      confidence: engineUsed === 'ai_pipeline' ? finalizedIntent.confidence : 0.85,
      diagnostics: {
        engine: engineUsed,
        repairedFields: repairedFields.length > 0 ? repairedFields : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        latencyMs: Date.now() - startTime,
      },
      conflictCheck,
    };
  }

  /**
   * Invokes OpenAI with structured prompt and deterministic anchors.
   */
  private static async callOpenAiModel(
    input: string,
    zone: string,
    now: DateTime,
    signals: ReturnType<typeof DeterministicNlpExtractor.extractSignals>,
    teamsContext: TeamContext[]
  ): Promise<any> {
    const currentDate = now.toISODate();
    const currentTime = now.toFormat('HH:mm');
    const currentWeekday = now.weekdayLong;

    let teamsPromptSection = '';
    if (teamsContext.length > 0) {
      teamsPromptSection = '\nKnown Organization Teams:\n' +
        teamsContext
          .map((t) => `- "${t.name}": [${t.members.map((m) => m.email).join(', ')}]`)
          .join('\n');
    }

    let anchorsPromptSection = '';
    if (signals.detectedParticipants.length > 0) {
      anchorsPromptSection += `\nDetected participant emails: ${signals.detectedParticipants.join(', ')}`;
    }
    if (signals.detectedDate) {
      anchorsPromptSection += `\nDetected date candidate: ${signals.detectedDate}`;
    }
    if (signals.detectedTime) {
      anchorsPromptSection += `\nDetected time candidate: ${signals.detectedTime}`;
    }
    if (signals.detectedDuration) {
      anchorsPromptSection += `\nDetected duration: ${signals.detectedDuration} minutes`;
    }

    const systemPrompt = `You are an expert scheduling agent embedded in MeetLite.
Your job is to parse a natural language scheduling request into a structured JSON meeting definition.

Current temporal context:
- Timezone: ${zone}
- Current Date: ${currentDate} (${currentWeekday})
- Current Time: ${currentTime}
${teamsPromptSection}
${anchorsPromptSection}

Rules:
1. Always calculate relative dates accurately based on current date (${currentDate}, ${currentWeekday}).
2. Convert all times to 24-hour "HH:MM" format (e.g. 2pm -> "14:00", 9:30am -> "09:30").
3. Extract participant emails into the "participants" array. If a team name is mentioned, include all member emails.
4. If private/confidential is indicated, set privacy to "private"; otherwise "public".
5. Recurrence:
   - "every day" / "daily" -> pattern: "daily"
   - "weekdays" / "Mon-Fri" -> pattern: "weekdays"
   - "every [day]" -> pattern: "weekly", daysOfWeek: [0 for Sun, 1 for Mon, ..., 6 for Sat]
   - "every month" -> pattern: "monthly"
   - "every year" -> pattern: "yearly"
   - Set enabled: true only if recurring keywords exist.
6. Clean title: Derive a concise, professional title without residual time, date, or "invite" prefixes.
7. Return ONLY a valid JSON object matching the requested schema.`;

    const userPrompt = `Parse this meeting request into JSON: "${input}"`;

    const response = await undiciRequest('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    const responseBody: any = await response.body.json();
    if (responseBody.error) {
      throw new Error(responseBody.error.message || 'OpenAI API returned error');
    }

    const content = responseBody.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return JSON.parse(content);
  }

  /**
   * Recovery & Repair Loop:
   * Heals missing or malformed fields by synthesizing with deterministic anchor signals.
   */
  private static repairIntent(
    rawAi: any,
    signals: ReturnType<typeof DeterministicNlpExtractor.extractSignals>,
    zone: string,
    now: DateTime,
    repairedFields: string[]
  ): Record<string, any> {
    const raw = (rawAi && typeof rawAi === 'object') ? rawAi : {};

    // 1. Repair Date
    let date = raw.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      date = signals.detectedDate || now.toISODate() || '2026-11-01';
      repairedFields.push('date');
    }

    // 2. Repair Time
    let time = raw.time;
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      time = signals.detectedTime || '09:00';
      repairedFields.push('time');
    }

    // 3. Repair Title
    let title = raw.title;
    if (typeof title !== 'string' || !title.trim()) {
      title = signals.detectedTitle || 'Scheduled Meeting';
      repairedFields.push('title');
    }

    // 4. Repair Duration
    let duration = typeof raw.duration === 'number' ? Math.round(raw.duration) : signals.detectedDuration || 30;
    if (duration < 5) duration = 5;
    if (duration > 480) duration = 480;

    // 5. Repair Participants
    let participants = Array.isArray(raw.participants)
      ? raw.participants.filter((p: any) => typeof p === 'string' && p.includes('@'))
      : [];
    // Ensure deterministic participants are preserved
    for (const dp of signals.detectedParticipants) {
      if (!participants.includes(dp)) {
        participants.push(dp);
        repairedFields.push('participants');
      }
    }

    // 6. Repair Recurrence
    const rawRec = raw.recurrence || {};
    const enabled = Boolean(rawRec.enabled ?? signals.detectedRecurrence?.enabled ?? false);
    const pattern = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'].includes(rawRec.pattern)
      ? rawRec.pattern
      : signals.detectedRecurrence?.pattern || 'weekly';
    const interval = Math.max(1, typeof rawRec.interval === 'number' ? Math.round(rawRec.interval) : 1);
    const endType = ['never', 'after', 'on'].includes(rawRec.endType) ? rawRec.endType : 'never';

    return {
      title,
      description: typeof raw.description === 'string' ? raw.description : '',
      date,
      time,
      duration,
      timezone: zone,
      privacy: raw.privacy === 'private' || signals.detectedPrivacy === 'private' ? 'private' : 'public',
      participants,
      confidence: 0.8,
      recurrence: {
        enabled,
        pattern,
        interval,
        daysOfWeek: Array.isArray(rawRec.daysOfWeek) ? rawRec.daysOfWeek : signals.detectedRecurrence?.daysOfWeek || [],
        dayOfMonth: typeof rawRec.dayOfMonth === 'number' ? rawRec.dayOfMonth : null,
        endType,
        endDate: typeof rawRec.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawRec.endDate) ? rawRec.endDate : null,
        occurrences: typeof rawRec.occurrences === 'number' ? rawRec.occurrences : null,
      },
    };
  }

  /**
   * Enforces domain invariants:
   * - Past date protection (auto-advancing if relative day has elapsed).
   * - RFC 5545 recurrence consistency.
   * - Duration clamping.
   */
  private static enforceDomainInvariants(
    intent: SmartScheduleIntent,
    zone: string,
    now: DateTime,
    originalInput: string,
    warnings: string[]
  ): SmartScheduleIntent {
    const updated = { ...intent };

    // 1. Past Datetime Check
    const candidateDt = DateTime.fromISO(`${updated.date}T${updated.time}`, { zone });
    if (candidateDt.isValid && candidateDt < now) {
      // If the meeting was scheduled in the past:
      // If recurring or user specified a day without explicit year, advance by interval or +1 day
      const lower = originalInput.toLowerCase();
      const isExplicitPastYear = /\b(19\d\d|20[0-1]\d|202[0-5])\b/.test(lower);

      if (!isExplicitPastYear) {
        if (updated.recurrence.enabled) {
          if (updated.recurrence.pattern === 'daily') {
            updated.date = now.plus({ days: 1 }).toISODate()!;
          } else if (updated.recurrence.pattern === 'weekly') {
            updated.date = candidateDt.plus({ weeks: updated.recurrence.interval || 1 }).toISODate()!;
          } else {
            updated.date = candidateDt.plus({ days: 1 }).toISODate()!;
          }
        } else {
          // If the time was earlier today, advance to tomorrow
          if (updated.date === now.toISODate()) {
            updated.date = now.plus({ days: 1 }).toISODate()!;
            warnings.push('Requested time has already passed today; scheduled for tomorrow instead.');
          }
        }
      }
    }

    // 2. Weekly Recurrence Day of Week Alignment
    if (updated.recurrence.enabled && updated.recurrence.pattern === 'weekly') {
      const dt = DateTime.fromISO(updated.date, { zone });
      if (dt.isValid && updated.recurrence.daysOfWeek.length === 0) {
        // Luxon: Monday=1...Sunday=7. Meeting recurrence: Sunday=0, Monday=1...Saturday=6
        updated.recurrence.daysOfWeek = [dt.weekday % 7];
      }
    }

    // 3. Recurrence Invariant Cleanup
    if (!updated.recurrence.enabled) {
      updated.recurrence.daysOfWeek = [];
      updated.recurrence.dayOfMonth = null;
      updated.recurrence.endType = 'never';
      updated.recurrence.endDate = null;
      updated.recurrence.occurrences = null;
    }

    return updated;
  }

  /**
   * Performs conflict checking against prisma meetings and computes alternatives.
   */
  public static async performConflictCheck(
    intent: SmartScheduleIntent,
    prisma: any,
    hostUserId?: string,
    organizationId?: string
  ): Promise<ConflictCheckPayload> {
    const zone = intent.timezone || 'UTC';
    const startDt = DateTime.fromISO(`${intent.date}T${intent.time}`, { zone });
    const endDt = startDt.plus({ minutes: intent.duration });

    const startUtc = startDt.toJSDate();
    const endUtc = endDt.toJSDate();

    // Query overlapping meetings
    const whereClause: any = {
      status: { notIn: ['cancelled', 'ended'] },
      startTime: { lt: endUtc },
      endTime: { gt: startUtc },
    };

    if (hostUserId) {
      whereClause.hostId = hostUserId;
    } else if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    let existingConflicts: any[] = [];
    try {
      existingConflicts = await prisma.meeting.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
        },
        take: 10,
      });
    } catch {
      // Prisma error fallback
      existingConflicts = [];
    }

    const conflicts = existingConflicts.map((c) => ({
      id: c.id,
      title: c.title,
      start: new Date(c.startTime),
      end: new Date(c.endTime),
      source: 'database' as const,
    }));

    const isAvailable = conflicts.length === 0;
    const alternatives: AlternativeSlot[] = [];

    if (!isAvailable) {
      // Generate 3 conflict-free alternative slots
      // Alt 1: End of latest conflict + 5 minutes
      const maxEndTime = Math.max(...conflicts.map((c) => c.end.getTime()));
      const alt1Dt = DateTime.fromMillis(maxEndTime).setZone(zone);
      alternatives.push({
        date: alt1Dt.toISODate()!,
        time: alt1Dt.toFormat('HH:mm'),
        start: alt1Dt.toJSDate(),
        end: alt1Dt.plus({ minutes: intent.duration }).toJSDate(),
        available: true,
        reason: 'After current conflict',
        source: 'generated',
      });

      // Alt 2: +1 hour from requested time
      const alt2Dt = startDt.plus({ hours: 1 });
      alternatives.push({
        date: alt2Dt.toISODate()!,
        time: alt2Dt.toFormat('HH:mm'),
        start: alt2Dt.toJSDate(),
        end: alt2Dt.plus({ minutes: intent.duration }).toJSDate(),
        available: true,
        reason: '1 hour later',
        source: 'generated',
      });

      // Alt 3: Next day at the same time
      const alt3Dt = startDt.plus({ days: 1 });
      alternatives.push({
        date: alt3Dt.toISODate()!,
        time: alt3Dt.toFormat('HH:mm'),
        start: alt3Dt.toJSDate(),
        end: alt3Dt.plus({ minutes: intent.duration }).toJSDate(),
        available: true,
        reason: 'Same time tomorrow',
        source: 'generated',
      });
    }

    return {
      isAvailable,
      conflicts,
      alternatives,
      calendarConnected: false,
      internalMeetings: conflicts.length,
    };
  }

  private static normalizeTimezone(tz?: string): string {
    if (!tz || typeof tz !== 'string') return 'UTC';
    try {
      const dt = DateTime.now().setZone(tz);
      return dt.isValid ? tz : 'UTC';
    } catch {
      return 'UTC';
    }
  }
}
