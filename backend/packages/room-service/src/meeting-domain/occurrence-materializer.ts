/**
 * MLTR-04: Occurrence Materializer Service
 * Invariant: Retries and concurrent schedulers create at most one row per occurrence key.
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
  ValidatedRecurrence,
} from './recurrence/recurrence-types.js';
import {
  TenantContext,
  MeetingSeriesRecord,
} from './repositories/meeting-repository.types.js';

export interface MaterializeOccurrencesCommand {
  seriesId: string;
  expectedRevision: number;
  fromInclusive?: Date;
  throughExclusive: Date;
  commandId: string;
  tenant?: TenantContext;
}

export interface MaterializationResult {
  seriesId: string;
  created: number;
  existing: number;
  skippedExceptions: number;
  materializedThrough: Date;
}

export interface OccurrenceMaterializerConfig {
  meetingRepository: MeetingRepository;
  outboxRepository: OutboxRepository;
  recurrenceEngine: RecurrenceEngine;
}

export class OccurrenceMaterializer {
  private readonly meetingRepo: MeetingRepository;
  private readonly outboxRepo: OutboxRepository;
  private readonly recurrenceEngine: RecurrenceEngine;

  constructor(config: OccurrenceMaterializerConfig) {
    this.meetingRepo = config.meetingRepository;
    this.outboxRepo = config.outboxRepository;
    this.recurrenceEngine = config.recurrenceEngine;
  }

  /**
   * Idempotently materializes occurrences for a single series up to throughExclusive.
   */
  async materialize(
    command: MaterializeOccurrencesCommand
  ): Promise<MaterializationResult> {
    const tenant = command.tenant ?? {};
    const series = await this.meetingRepo.findSeriesById(command.seriesId, tenant);

    if (!series) {
      const err: any = new Error(`SERIES_NOT_FOUND: Meeting series ${command.seriesId} not found`);
      err.code = 'SERIES_NOT_FOUND';
      throw err;
    }

    if (series.status !== 'ACTIVE') {
      return {
        seriesId: series.seriesId,
        created: 0,
        existing: 0,
        skippedExceptions: 0,
        materializedThrough: series.materializedThrough ?? new Date(),
      };
    }

    // 1. Invariant: Concurrency revision check
    if (series.revision !== command.expectedRevision) {
      const err: any = new Error(
        `SERIES_REVISION_CONFLICT: Expected series revision ${command.expectedRevision}, found ${series.revision}`
      );
      err.code = 'SERIES_REVISION_CONFLICT';
      throw err;
    }

    // 2. Fetch exceptions (cancelled or overridden keys)
    const exceptions = await this.meetingRepo.findExceptionsBySeries(series.seriesId, tenant);
    const cancelledKeys = new Set(
      exceptions.filter((e) => e.kind === 'CANCELLED').map((e) => e.occurrenceKey)
    );

    // 3. Construct validated recurrence input for engine expansion
    const validated: ValidatedRecurrence = {
      localDate: series.localStartDate,
      localTime: series.localStartTime,
      timeZone: series.timeZone,
      rruleString: series.recurrenceRule,
      spec: { frequency: 'daily', interval: 1, end: { type: 'never' } } as any,
    };

    // Expand starting from requested fromInclusive or 1 second after already materializedThrough
    const fromInclusive = command.fromInclusive ?? (
      series.materializedThrough
        ? new Date(series.materializedThrough.getTime() + 1000)
        : new Date(series.createdAt.getTime() + 1000)
    );

    const seeds = this.recurrenceEngine.expand(validated, {
      fromInclusive,
      toExclusive: command.throughExclusive,
      limit: 500,
    });

    let createdCount = 0;
    let existingCount = 0;
    let skippedExceptionsCount = 0;

    for (const seed of seeds) {
      // If marked as cancelled in exceptions, skip creation
      if (cancelledKeys.has(seed.occurrenceKey)) {
        skippedExceptionsCount += 1;
        continue;
      }

      const meetingPublicId = `meet_${randomUUID().replace(/-/g, '')}`;
      const upsertResult = await this.meetingRepo.upsertOccurrence({
        seriesId: series.id,
        seed: {
          meetingId: meetingPublicId,
          occurrenceKey: seed.occurrenceKey,
          scheduledAt: seed.scheduledAt,
          eventTimeZone: series.timeZone,
          durationMinutes: series.durationMinutes,
          title: series.title,
          description: series.description,
          privacy: series.privacy,
        },
        tenant,
      });

      if (upsertResult.created) {
        createdCount += 1;
        await this.outboxRepo.append({
          eventId: `evt_${randomUUID().replace(/-/g, '')}`,
          aggregateType: 'meeting-occurrence',
          aggregateId: upsertResult.occurrence.meetingId,
          eventType: 'meeting.occurrence.created.v1',
          schemaVersion: 1,
          payload: {
            meetingId: upsertResult.occurrence.meetingId,
            seriesId: series.seriesId,
            occurrenceKey: upsertResult.occurrence.occurrenceKey,
            scheduledAt: upsertResult.occurrence.scheduledAt.toISOString(),
            eventTimeZone: upsertResult.occurrence.eventTimeZone,
            durationMinutes: upsertResult.occurrence.durationMinutes,
          },
          occurredAt: upsertResult.occurrence.createdAt,
        });
      } else {
        existingCount += 1;
      }
    }

    // Advance materializedThrough
    await this.meetingRepo.advanceMaterializedThrough(
      series.seriesId,
      command.throughExclusive,
      tenant
    );

    return {
      seriesId: series.seriesId,
      created: createdCount,
      existing: existingCount,
      skippedExceptions: skippedExceptionsCount,
      materializedThrough: command.throughExclusive,
    };
  }

  /**
   * Batch discovery and materialization of all active series due for expansion.
   */
  async materializeDueSeries(
    horizon: Date,
    limit = 50
  ): Promise<readonly MaterializationResult[]> {
    const dueSeries = await this.meetingRepo.findDueSeriesForMaterialization(horizon, limit);
    const results: MaterializationResult[] = [];

    for (const series of dueSeries) {
      try {
        const result = await this.materialize({
          seriesId: series.seriesId,
          expectedRevision: series.revision,
          throughExclusive: horizon,
          commandId: `cmd_mat_${randomUUID()}`,
          tenant: { organizationId: series.organizationId, teamId: series.teamId },
        });
        results.push(result);
      } catch (err: any) {
        // Concurrency conflict or failure: log and skip to allow next cycle reconciliation
        console.error(`[Materializer] Failed to materialize series ${series.seriesId}:`, err);
      }
    }

    return results;
  }
}
