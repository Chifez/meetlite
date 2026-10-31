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
import { SeriesSplitter } from './series-splitter.js';

export type RecurrenceMutationScope = 'occurrence' | 'following' | 'series';

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

export interface UpdateMeetingCommand {
  idempotencyKey: string;
  targetMeetingId: string;
  scope?: RecurrenceMutationScope;
  expectedRevision: number;
  patch: {
    title?: string;
    description?: string;
    localDate?: LocalDate;
    localTime?: LocalTime;
    timeZone?: IanaTimeZone;
    durationMinutes?: number;
    privacy?: 'public' | 'private';
    recurrence?: RecurrenceSpec;
    disambiguation?: 'earlier' | 'later';
  };
}

export interface UpdateMeetingResult {
  scope: RecurrenceMutationScope;
  view: MeetingView;
  series?: MeetingSeriesRecord;
  affectedOccurrencesCount: number;
}

export interface CancelMeetingCommand {
  idempotencyKey: string;
  targetMeetingId: string;
  scope?: RecurrenceMutationScope;
  expectedRevision: number;
  reason?: string;
}

export interface CancelMeetingResult {
  scope: RecurrenceMutationScope;
  view: MeetingView;
  series?: MeetingSeriesRecord;
  affectedOccurrencesCount: number;
}

export interface MeetingApplicationConfig {
  meetingRepository: MeetingRepository;
  outboxRepository: OutboxRepository;
  recurrenceEngine: RecurrenceEngine;
  now?: () => Date;
}

export class MeetingApplication {
  private readonly meetingRepo: MeetingRepository;
  private readonly outboxRepo: OutboxRepository;
  private readonly recurrenceEngine: RecurrenceEngine;
  private readonly now: () => Date;

  constructor(config: MeetingApplicationConfig) {
    this.meetingRepo = config.meetingRepository;
    this.outboxRepo = config.outboxRepository;
    this.recurrenceEngine = config.recurrenceEngine;
    this.now = config.now ?? (() => new Date());
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
    if (scheduledAt.getTime() <= this.now().getTime()) {
      throw Object.assign(new Error('MEETING_TIME_IN_PAST: Meeting time must be in the future'), {
        code: 'MEETING_TIME_IN_PAST',
      });
    }
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
      const occurredAt = new Date();
      const createEvents = [
        {
          eventId: `evt_${randomUUID().replace(/-/g, '')}`,
          aggregateType: 'meeting-series',
          aggregateId: seriesPublicId,
          eventType: 'meeting.series.created.v1',
          schemaVersion: 1,
          payload: {
            seriesId: seriesPublicId,
            createdBy: principal.userId,
            title: command.title,
            timeZone: command.timeZone,
            localStartDate: command.localDate,
            localStartTime: command.localTime,
            recurrenceRule: validatedRecurrence.value.rruleString,
          },
          occurredAt,
        },
        {
          eventId: `evt_${randomUUID().replace(/-/g, '')}`,
          aggregateType: 'meeting-occurrence',
          aggregateId: firstMeetingPublicId,
          eventType: 'meeting.occurrence.created.v1',
          schemaVersion: 1,
          payload: {
            meetingId: firstMeetingPublicId,
            seriesId: seriesPublicId,
            occurrenceKey,
            scheduledAt: scheduledAt.toISOString(),
            eventTimeZone: command.timeZone,
            durationMinutes: command.durationMinutes,
            attendeeEmails: command.attendeeEmails ?? [],
          },
          occurredAt,
        },
      ];

      const { series, firstOccurrence, outboxCommitted } = await this.meetingRepo.createSeriesWithFirstOccurrence({
        idempotencyKey: command.idempotencyKey,
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
        outboxEvents: createEvents,
      });
      if (!outboxCommitted) {
        for (const event of createEvents) await this.outboxRepo.append(event);
      }

      const view = MeetingPolicy.buildMeetingView({
        meeting: firstOccurrence,
        series,
        principal,
        viewerTimeZone: command.timeZone,
      });

      return { series, view };
    }

    // 4. One-off Meeting Path (Occurrence without series)
    const meetingPublicId = `meet_${randomUUID().replace(/-/g, '')}`;
    const occurrenceEvent = {
      eventId: `evt_${randomUUID().replace(/-/g, '')}`,
      aggregateType: 'meeting-occurrence',
      aggregateId: meetingPublicId,
      eventType: 'meeting.occurrence.created.v1',
      schemaVersion: 1,
      payload: {
        meetingId: meetingPublicId,
        scheduledAt: scheduledAt.toISOString(),
        eventTimeZone: command.timeZone,
        durationMinutes: command.durationMinutes,
        attendeeEmails: command.attendeeEmails ?? [],
      },
      occurredAt: new Date(),
    };
    const { occurrence, outboxCommitted } = await this.meetingRepo.upsertOccurrence({
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
      idempotencyKey: command.idempotencyKey,
      attendeeEmails: command.attendeeEmails,
      outboxEvents: [occurrenceEvent],
    });
    if (!outboxCommitted) await this.outboxRepo.append(occurrenceEvent);

    const view = MeetingPolicy.buildMeetingView({
      meeting: occurrence,
      series: null,
      principal,
      viewerTimeZone: command.timeZone,
    });

    return { view };
  }

  async getView(params: {
    meetingId: string;
    principal: PolicyPrincipal;
    viewerTimeZone?: string;
    isParticipant?: boolean;
    isInvited?: boolean;
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
      isParticipant: params.isParticipant,
      isInvited: params.isInvited,
    });
  }

  async update(params: {
    principal: PolicyPrincipal;
    command: UpdateMeetingCommand;
    correlationId?: string;
  }): Promise<UpdateMeetingResult> {
    const { principal, command } = params;

    if (!command.idempotencyKey) {
      const err: any = new Error('MISSING_IDEMPOTENCY_KEY: Idempotency-Key is required');
      err.code = 'MISSING_IDEMPOTENCY_KEY';
      throw err;
    }

    const tenant = { organizationId: principal.orgId };
    const meeting = await this.meetingRepo.findMeetingById(command.targetMeetingId, tenant);
    if (!meeting) {
      const err: any = new Error(`MEETING_NOT_FOUND: Meeting ${command.targetMeetingId} not found`);
      err.code = 'MEETING_NOT_FOUND';
      throw err;
    }

    let series: MeetingSeriesRecord | null = null;
    if (meeting.seriesId) {
      series = await this.meetingRepo.findSeriesById(meeting.seriesId, tenant);
    }

    // Evaluate capabilities
    const capabilities = MeetingPolicy.evaluateCapabilities({ meeting, series, principal });
    if (!capabilities.update.allowed) {
      const err: any = new Error(`MEETING_ACTION_FORBIDDEN: Update not allowed (${capabilities.update.reason})`);
      err.code = capabilities.update.reason === 'NOT_ORGANIZER' ? 'MEETING_ACTION_FORBIDDEN' : capabilities.update.reason;
      throw err;
    }

    const scope: RecurrenceMutationScope = series ? (command.scope ?? 'occurrence') : 'occurrence';

    if (scope === 'occurrence') {
      let scheduledAt = meeting.scheduledAt;
      let eventTimeZone = meeting.eventTimeZone;
      if (command.patch.localDate || command.patch.localTime || command.patch.timeZone) {
        const resolved = resolveZonedDateTime({
          date: command.patch.localDate ?? (meeting.occurrenceKey ? (meeting.occurrenceKey.split('T')[0] as LocalDate) : (meeting.scheduledAt.toISOString().slice(0, 10) as LocalDate)),
          time: command.patch.localTime ?? (meeting.occurrenceKey ? (meeting.occurrenceKey.split('T')[1] as LocalTime) : (meeting.scheduledAt.toISOString().slice(11, 19) as LocalTime)),
          zone: (command.patch.timeZone ?? meeting.eventTimeZone) as IanaTimeZone,
          disambiguation: command.patch.disambiguation,
        });
        if (!resolved.ok) {
          const err: any = new Error(`${resolved.error.code}: ${resolved.error.message}`);
          err.code = resolved.error.code;
          throw err;
        }
        scheduledAt = resolved.value.utcInstant;
        eventTimeZone = command.patch.timeZone ?? meeting.eventTimeZone;
      }

      const updated = await this.meetingRepo.updateMeetingOccurrence({
        meetingId: meeting.meetingId,
        patch: {
          title: command.patch.title,
          description: command.patch.description,
          durationMinutes: command.patch.durationMinutes,
          privacy: command.patch.privacy,
          scheduledAt,
          eventTimeZone,
        },
        expectedRevision: command.expectedRevision,
        tenant,
      });

      if (series && meeting.occurrenceKey) {
        await this.meetingRepo.createException({
          seriesId: series.seriesId,
          occurrenceKey: meeting.occurrenceKey,
          kind: 'OVERRIDDEN',
          overrideMeetingId: updated.meetingId,
          seriesRevision: series.revision,
          tenant,
        });
      }

      await this.outboxRepo.append({
        eventId: `evt_${randomUUID().replace(/-/g, '')}`,
        aggregateType: 'meeting-occurrence',
        aggregateId: updated.meetingId,
        eventType: 'meeting.occurrence.updated.v1',
        schemaVersion: 1,
        payload: {
          meetingId: updated.meetingId,
          seriesId: series?.seriesId ?? null,
          title: updated.title,
          scheduledAt: updated.scheduledAt.toISOString(),
          durationMinutes: updated.durationMinutes,
        },
        occurredAt: new Date(),
      });

      const view = MeetingPolicy.buildMeetingView({
        meeting: updated,
        series,
        principal,
        viewerTimeZone: eventTimeZone,
      });

      return { scope, view, series: series ?? undefined, affectedOccurrencesCount: 1 };
    }

    if (scope === 'series') {
      if (!series) {
        const err: any = new Error('NOT_RECURRING: Cannot perform series update on a non-recurring meeting');
        err.code = 'NOT_RECURRING';
        throw err;
      }

      let recurrenceRule = series.recurrenceRule;
      if (command.patch.recurrence) {
        const validated = this.recurrenceEngine.validate({
          localDate: series.localStartDate,
          localTime: series.localStartTime,
          timeZone: series.timeZone,
          spec: command.patch.recurrence,
        });
        if (!validated.ok) {
          const err: any = new Error(`INVALID_RECURRENCE: ${validated.error.message}`);
          err.code = 'INVALID_RECURRENCE';
          throw err;
        }
        recurrenceRule = validated.value.rruleString;
      }

      const { series: updatedSeries, updatedOccurrencesCount } =
        await this.meetingRepo.updateSeriesAndOccurrences({
          seriesId: series.seriesId,
          expectedRevision: command.expectedRevision,
          seriesPatch: {
            title: command.patch.title,
            description: command.patch.description,
            durationMinutes: command.patch.durationMinutes,
            privacy: command.patch.privacy,
            recurrenceRule,
          },
          tenant,
        });

      await this.outboxRepo.append({
        eventId: `evt_${randomUUID().replace(/-/g, '')}`,
        aggregateType: 'meeting-series',
        aggregateId: updatedSeries.seriesId,
        eventType: 'meeting.series.updated.v1',
        schemaVersion: 1,
        payload: {
          seriesId: updatedSeries.seriesId,
          title: updatedSeries.title,
          recurrenceRule: updatedSeries.recurrenceRule,
          revision: updatedSeries.revision,
        },
        occurredAt: new Date(),
      });

      const updatedMeeting = (await this.meetingRepo.findMeetingById(meeting.meetingId, tenant)) ?? meeting;
      const view = MeetingPolicy.buildMeetingView({
        meeting: updatedMeeting,
        series: updatedSeries,
        principal,
        viewerTimeZone: updatedSeries.timeZone,
      });

      return { scope, view, series: updatedSeries, affectedOccurrencesCount: updatedOccurrencesCount };
    }

    if (scope === 'following') {
      if (!series || !meeting.occurrenceKey) {
        const err: any = new Error('NOT_RECURRING: Cannot split series on a non-recurring meeting');
        err.code = 'NOT_RECURRING';
        throw err;
      }

      let updatedSuccessorRule: string | undefined = undefined;
      if (command.patch.recurrence) {
        const validated = this.recurrenceEngine.validate({
          localDate: meeting.occurrenceKey.split('T')[0] as LocalDate,
          localTime: meeting.occurrenceKey.split('T')[1] as LocalTime,
          timeZone: series.timeZone,
          spec: command.patch.recurrence,
        });
        if (!validated.ok) {
          const err: any = new Error(`INVALID_RECURRENCE: ${validated.error.message}`);
          err.code = 'INVALID_RECURRENCE';
          throw err;
        }
        updatedSuccessorRule = validated.value.rruleString;
      }

      const plan = SeriesSplitter.planSplit({
        series,
        targetOccurrenceKey: meeting.occurrenceKey,
        splitInstant: meeting.scheduledAt,
        updatedSuccessorRule,
      });

      const successorPublicId = `series_${randomUUID().replace(/-/g, '')}`;

      const { predecessorSeries, successorSeries, updatedMeeting } =
        await this.meetingRepo.splitSeriesAtOccurrence({
          predecessorSeriesId: series.seriesId,
          expectedRevision: command.expectedRevision,
          cappedPredecessorRule: plan.cappedPredecessorRule,
          successorSeries: {
            seriesId: successorPublicId,
            organizationId: series.organizationId,
            teamId: series.teamId,
            createdBy: principal.userId,
            title: command.patch.title ?? series.title,
            description: command.patch.description !== undefined ? command.patch.description : series.description,
            durationMinutes: command.patch.durationMinutes ?? series.durationMinutes,
            privacy: command.patch.privacy ?? series.privacy,
            timeZone: series.timeZone,
            localStartDate: plan.successorStartDate as LocalDate,
            localStartTime: plan.successorStartTime as LocalTime,
            recurrenceRule: plan.successorRule,
          },
          targetMeetingId: meeting.meetingId,
          tenant,
        });

      await this.outboxRepo.append({
        eventId: `evt_${randomUUID().replace(/-/g, '')}`,
        aggregateType: 'meeting-series',
        aggregateId: predecessorSeries.seriesId,
        eventType: 'meeting.series.updated.v1',
        schemaVersion: 1,
        payload: {
          seriesId: predecessorSeries.seriesId,
          recurrenceRule: predecessorSeries.recurrenceRule,
          revision: predecessorSeries.revision,
        },
        occurredAt: new Date(),
      });

      await this.outboxRepo.append({
        eventId: `evt_${randomUUID().replace(/-/g, '')}`,
        aggregateType: 'meeting-series',
        aggregateId: successorSeries.seriesId,
        eventType: 'meeting.series.created.v1',
        schemaVersion: 1,
        payload: {
          seriesId: successorSeries.seriesId,
          localStartDate: successorSeries.localStartDate,
          localStartTime: successorSeries.localStartTime,
          recurrenceRule: successorSeries.recurrenceRule,
        },
        occurredAt: new Date(),
      });

      const view = MeetingPolicy.buildMeetingView({
        meeting: updatedMeeting,
        series: successorSeries,
        principal,
        viewerTimeZone: successorSeries.timeZone,
      });

      return { scope, view, series: successorSeries, affectedOccurrencesCount: 1 };
    }

    throw new Error(`INVALID_SCOPE: ${scope}`);
  }

  async cancel(params: {
    principal: PolicyPrincipal;
    command: CancelMeetingCommand;
    correlationId?: string;
  }): Promise<CancelMeetingResult> {
    const { principal, command } = params;

    if (!command.idempotencyKey) {
      const err: any = new Error('MISSING_IDEMPOTENCY_KEY: Idempotency-Key is required');
      err.code = 'MISSING_IDEMPOTENCY_KEY';
      throw err;
    }

    const tenant = { organizationId: principal.orgId };
    const meeting = await this.meetingRepo.findMeetingById(command.targetMeetingId, tenant);
    if (!meeting) {
      const err: any = new Error(`MEETING_NOT_FOUND: Meeting ${command.targetMeetingId} not found`);
      err.code = 'MEETING_NOT_FOUND';
      throw err;
    }

    let series: MeetingSeriesRecord | null = null;
    if (meeting.seriesId) {
      series = await this.meetingRepo.findSeriesById(meeting.seriesId, tenant);
    }

    const capabilities = MeetingPolicy.evaluateCapabilities({ meeting, series, principal });
    if (!capabilities.cancel.allowed) {
      const err: any = new Error(`MEETING_ACTION_FORBIDDEN: Cancel not allowed (${capabilities.cancel.reason})`);
      err.code = capabilities.cancel.reason === 'NOT_ORGANIZER' ? 'MEETING_ACTION_FORBIDDEN' : capabilities.cancel.reason;
      throw err;
    }

    const scope: RecurrenceMutationScope = series ? (command.scope ?? 'occurrence') : 'occurrence';

    if (scope === 'occurrence') {
      const updated = await this.meetingRepo.cancelMeetingOccurrence({
        meetingId: meeting.meetingId,
        expectedRevision: command.expectedRevision,
        tenant,
      });

      if (series && meeting.occurrenceKey) {
        await this.meetingRepo.createException({
          seriesId: series.seriesId,
          occurrenceKey: meeting.occurrenceKey,
          kind: 'CANCELLED',
          seriesRevision: series.revision,
          tenant,
        });
      }

      await this.outboxRepo.append({
        eventId: `evt_${randomUUID().replace(/-/g, '')}`,
        aggregateType: 'meeting-occurrence',
        aggregateId: updated.meetingId,
        eventType: 'meeting.occurrence.cancelled.v1',
        schemaVersion: 1,
        payload: {
          meetingId: updated.meetingId,
          seriesId: series?.seriesId ?? null,
          occurrenceKey: updated.occurrenceKey,
          reason: command.reason,
        },
        occurredAt: new Date(),
      });

      const view = MeetingPolicy.buildMeetingView({
        meeting: updated,
        series,
        principal,
        viewerTimeZone: updated.eventTimeZone,
      });

      return { scope, view, series: series ?? undefined, affectedOccurrencesCount: 1 };
    }

    if (scope === 'series') {
      if (!series) {
        const err: any = new Error('NOT_RECURRING: Cannot cancel series on a non-recurring meeting');
        err.code = 'NOT_RECURRING';
        throw err;
      }

      const { series: updatedSeries, cancelledOccurrencesCount } =
        await this.meetingRepo.cancelSeries({
          seriesId: series.seriesId,
          expectedRevision: command.expectedRevision,
          tenant,
        });

      await this.outboxRepo.append({
        eventId: `evt_${randomUUID().replace(/-/g, '')}`,
        aggregateType: 'meeting-series',
        aggregateId: updatedSeries.seriesId,
        eventType: 'meeting.series.cancelled.v1',
        schemaVersion: 1,
        payload: {
          seriesId: updatedSeries.seriesId,
          cancelledOccurrencesCount,
          reason: command.reason,
        },
        occurredAt: new Date(),
      });

      const updatedMeeting = (await this.meetingRepo.findMeetingById(meeting.meetingId, tenant)) ?? meeting;
      const view = MeetingPolicy.buildMeetingView({
        meeting: updatedMeeting,
        series: updatedSeries,
        principal,
        viewerTimeZone: updatedSeries.timeZone,
      });

      return { scope, view, series: updatedSeries, affectedOccurrencesCount: cancelledOccurrencesCount };
    }

    if (scope === 'following') {
      if (!series || !meeting.occurrenceKey) {
        const err: any = new Error('NOT_RECURRING: Cannot cancel following on a non-recurring meeting');
        err.code = 'NOT_RECURRING';
        throw err;
      }

      const plan = SeriesSplitter.planSplit({
        series,
        targetOccurrenceKey: meeting.occurrenceKey,
        splitInstant: meeting.scheduledAt,
      });

      const { series: updatedSeries, cancelledOccurrencesCount } =
        await this.meetingRepo.cancelFollowingOccurrences({
          seriesId: series.seriesId,
          fromOccurrenceKey: meeting.occurrenceKey,
          expectedRevision: command.expectedRevision,
          cappedRule: plan.cappedPredecessorRule,
          tenant,
        });

      await this.outboxRepo.append({
        eventId: `evt_${randomUUID().replace(/-/g, '')}`,
        aggregateType: 'meeting-series',
        aggregateId: updatedSeries.seriesId,
        eventType: 'meeting.series.updated.v1',
        schemaVersion: 1,
        payload: {
          seriesId: updatedSeries.seriesId,
          recurrenceRule: updatedSeries.recurrenceRule,
          revision: updatedSeries.revision,
          action: 'following_cancelled',
        },
        occurredAt: new Date(),
      });

      const updatedMeeting = (await this.meetingRepo.findMeetingById(meeting.meetingId, tenant)) ?? meeting;
      const view = MeetingPolicy.buildMeetingView({
        meeting: updatedMeeting,
        series: updatedSeries,
        principal,
        viewerTimeZone: updatedSeries.timeZone,
      });

      return { scope, view, series: updatedSeries, affectedOccurrencesCount: cancelledOccurrencesCount };
    }

    throw new Error(`INVALID_SCOPE: ${scope}`);
  }
}
