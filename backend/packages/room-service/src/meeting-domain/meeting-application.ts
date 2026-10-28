/**
 * MLTR-03: Meeting Application Service
 * Orchestrates atomic series creation, zoned validation, idempotency, and transactional outbox.
 */

import { randomUUID } from 'node:crypto';
import {
  MeetingRepository,
} from './repositories/meeting.repository.js';
import {
  OutboxRepository,
} from './repositories/outbox.repository.js';
import {
  RecurrenceEngine,
} from './recurrence/recurrence-engine.js';
import {
  RecurrenceDefinition,
  RecurrenceSpec,
} from './recurrence/recurrence-types.js';
import {
  LocalDate,
  LocalTime,
  IanaTimeZone,
  resolveZonedDateTime,
  formatZonedKey,
} from './time/zoned-date-time.js';
import {
  MeetingPolicy,
  MeetingView,
  PolicyPrincipal,
} from './meeting-policy.js';
import {
  MeetingSeriesRecord,
  MeetingOccurrenceRecord,
} from './repositories/meeting-repository.types.js';

export interface CreateMeetingCommand {
  idempotencyKey: string;
  title: string;
  description?: string;
  localDate: LocalDate;
  localTime: LocalTime;
  timeZone: IanaTimeZone;
  durationMinutes: number;
  privacy: 'public' | 'private';
  attendeeEmails?: readonly string[];
  recurrence?: RecurrenceSpec;
  teamId?: string;
  disambiguation?: 'earlier' | 'later';
}

export interface CreateMeetingResult {
  series?: MeetingSeriesRecord;
  view: MeetingView;
}

export interface MeetingApplicationConfig {
  meetingRepository: MeetingRepository;
  outboxRepository: OutboxRepository;
  recurrenceEngine: RecurrenceEngine;
}

export class MeetingApplication {
  private readonly meetingRepo: MeetingRepository;
  private readonly outboxRepo: OutboxRepository;
  private readonly recurrenceEngine: RecurrenceEngine;
  private readonly idempotencyCache = new Map<string, CreateMeetingResult>();

  constructor(config: MeetingApplicationConfig) {
    this.meetingRepo = config.meetingRepository;
    this.outboxRepo = config.outboxRepository;
    this.recurrenceEngine = config.recurrenceEngine;
  }

  async create(params: {
    principal: PolicyPrincipal;
    command: CreateMeetingCommand;
    correlationId?: string;
  }): Promise<CreateMeetingResult> {
    const { principal, command } = params;

    // 1. Enforce Idempotency Key
    if (!command.idempotencyKey) {
      const err: any = new Error('MISSING_IDEMPOTENCY_KEY: Idempotency-Key header or property is required');
      err.code = 'MISSING_IDEMPOTENCY_KEY';
      throw err;
    }

    const cached = this.idempotencyCache.get(command.idempotencyKey);
    if (cached) {
      return cached;
    }

    // 2. Validate Zoned Date-Time with DST Gap and Ambiguity Handling
    const resolvedTime = resolveZonedDateTime({
      date: command.localDate,
      time: command.localTime,
      zone: command.timeZone,
      disambiguation: command.disambiguation,
    });

    if (!resolvedTime.ok) {
      const err: any = new Error(`${resolvedTime.error.code}: ${resolvedTime.error.message}`);
      err.code = resolvedTime.error.code;
      err.suggestedLocalTime = resolvedTime.error.suggestedNextValidTime;
      throw err;
    }

    const scheduledAt = resolvedTime.value.utcInstant;
    const occurrenceKey = formatZonedKey(command.localDate, command.localTime);
    const tenant = { organizationId: principal.orgId, teamId: command.teamId };

    // 3. Recurring Series Path
    if (command.recurrence) {
      const recurrenceDef: RecurrenceDefinition = {
        localDate: command.localDate,
        localTime: command.localTime,
        timeZone: command.timeZone,
        spec: command.recurrence,
      };

      const validatedRecurrence = this.recurrenceEngine.validate(recurrenceDef);
      if (!validatedRecurrence.ok) {
        const err: any = new Error(`INVALID_RECURRENCE: ${validatedRecurrence.error.message}`);
        err.code = 'INVALID_RECURRENCE';
        throw err;
      }

      const seriesPublicId = `series_${randomUUID().replace(/-/g, '')}`;
      const firstMeetingPublicId = `meet_${randomUUID().replace(/-/g, '')}`;

      const { series, firstOccurrence } = await this.meetingRepo.createSeriesWithFirstOccurrence({
        series: {
          seriesId: seriesPublicId,
          organizationId: principal.orgId,
          teamId: command.teamId,
          createdBy: principal.userId,
          title: command.title,
          description: command.description ?? null,
          durationMinutes: command.durationMinutes,
          privacy: command.privacy,
          timeZone: command.timeZone,
          localStartDate: command.localDate,
          localStartTime: command.localTime,
          recurrenceRule: validatedRecurrence.value.rruleString,
        },
        firstOccurrence: {
          meetingId: firstMeetingPublicId,
          occurrenceKey,
          scheduledAt,
          eventTimeZone: command.timeZone,
          durationMinutes: command.durationMinutes,
          title: command.title,
          description: command.description,
          privacy: command.privacy,
        },
        attendeeEmails: command.attendeeEmails,
      });

      // Transactional Outbox Append
      await this.outboxRepo.append({
        eventId: `evt_${randomUUID().replace(/-/g, '')}`,
        aggregateType: 'meeting-series',
        aggregateId: series.seriesId,
        eventType: 'meeting.series.created.v1',
        schemaVersion: 1,
        payload: {
          seriesId: series.seriesId,
          createdBy: series.createdBy,
          title: series.title,
          timeZone: series.timeZone,
          localStartDate: series.localStartDate,
          localStartTime: series.localStartTime,
          recurrenceRule: series.recurrenceRule,
        },
        occurredAt: series.createdAt,
      });

      await this.outboxRepo.append({
        eventId: `evt_${randomUUID().replace(/-/g, '')}`,
        aggregateType: 'meeting-occurrence',
        aggregateId: firstOccurrence.meetingId,
        eventType: 'meeting.occurrence.created.v1',
        schemaVersion: 1,
        payload: {
          meetingId: firstOccurrence.meetingId,
          seriesId: series.seriesId,
          occurrenceKey: firstOccurrence.occurrenceKey,
          scheduledAt: firstOccurrence.scheduledAt.toISOString(),
          eventTimeZone: firstOccurrence.eventTimeZone,
          durationMinutes: firstOccurrence.durationMinutes,
          attendeeEmails: command.attendeeEmails ?? [],
        },
        occurredAt: firstOccurrence.createdAt,
      });

      const view = MeetingPolicy.buildMeetingView({
        meeting: firstOccurrence,
        series,
        principal,
        viewerTimeZone: command.timeZone,
      });

      const result: CreateMeetingResult = { series, view };
      this.idempotencyCache.set(command.idempotencyKey, result);
      return result;
    }

    // 4. One-off Meeting Path (Occurrence without series)
    const meetingPublicId = `meet_${randomUUID().replace(/-/g, '')}`;
    const { occurrence } = await this.meetingRepo.upsertOccurrence({
      seriesId: null,
      seed: {
        meetingId: meetingPublicId,
        occurrenceKey: '',
        scheduledAt,
        eventTimeZone: command.timeZone,
        durationMinutes: command.durationMinutes,
        title: command.title,
        description: command.description,
        privacy: command.privacy,
      },
      tenant,
      createdBy: principal.userId,
    });

    await this.outboxRepo.append({
      eventId: `evt_${randomUUID().replace(/-/g, '')}`,
      aggregateType: 'meeting-occurrence',
      aggregateId: occurrence.meetingId,
      eventType: 'meeting.occurrence.created.v1',
      schemaVersion: 1,
      payload: {
        meetingId: occurrence.meetingId,
        scheduledAt: occurrence.scheduledAt.toISOString(),
        eventTimeZone: occurrence.eventTimeZone,
        durationMinutes: occurrence.durationMinutes,
        attendeeEmails: command.attendeeEmails ?? [],
      },
      occurredAt: occurrence.createdAt,
    });

    const view = MeetingPolicy.buildMeetingView({
      meeting: occurrence,
      series: null,
      principal,
      viewerTimeZone: command.timeZone,
    });

    const result: CreateMeetingResult = { view };
    this.idempotencyCache.set(command.idempotencyKey, result);
    return result;
  }

  async getView(params: {
    meetingId: string;
    principal: PolicyPrincipal;
    viewerTimeZone?: string;
  }): Promise<MeetingView> {
    const { meetingId, principal, viewerTimeZone = 'UTC' } = params;
    const tenant = { organizationId: principal.orgId };

    const meeting = await this.meetingRepo.findMeetingById(meetingId, tenant);
    if (!meeting) {
      const err: any = new Error(`MEETING_NOT_FOUND: Meeting ${meetingId} not found`);
      err.code = 'MEETING_NOT_FOUND';
      throw err;
    }

    let series: MeetingSeriesRecord | null = null;
    if (meeting.seriesId) {
      series = await this.meetingRepo.findSeriesById(meeting.seriesId, tenant);
    }

    return MeetingPolicy.buildMeetingView({
      meeting,
      series,
      principal,
      viewerTimeZone,
    });
  }
}
