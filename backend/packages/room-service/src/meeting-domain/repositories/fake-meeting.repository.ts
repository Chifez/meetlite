/**
 * MLTR-02: In-Memory Fake Meeting Repository
 * Enforces tenant scoping, (seriesId, occurrenceKey) uniqueness, and revision concurrency in memory.
 */

import { randomUUID } from 'node:crypto';
import {
  MeetingRepository,
} from './meeting.repository.js';
import {
  MeetingSeriesRecord,
  MeetingOccurrenceRecord,
  MeetingRecurrenceExceptionRecord,
  TenantContext,
  CreateSeriesWithFirstOccurrenceParams,
  CreateOccurrenceSeedParams,
  MeetingSeriesStatus,
  MeetingLifecycleStatus,
} from './meeting-repository.types.js';

export class FakeMeetingRepository implements MeetingRepository {
  private seriesStore = new Map<string, MeetingSeriesRecord>();
  private occurrenceStore = new Map<string, MeetingOccurrenceRecord>();
  private exceptionsStore: MeetingRecurrenceExceptionRecord[] = [];

  private matchesTenant(
    recordTenant: { organizationId?: string | null; teamId?: string | null },
    context: TenantContext
  ): boolean {
    if (context.organizationId && recordTenant.organizationId !== context.organizationId) {
      return false;
    }
    if (context.teamId && recordTenant.teamId !== context.teamId) {
      return false;
    }
    return true;
  }

  async createSeriesWithFirstOccurrence(
    params: CreateSeriesWithFirstOccurrenceParams
  ): Promise<{
    series: MeetingSeriesRecord;
    firstOccurrence: MeetingOccurrenceRecord;
  }> {
    const seriesInternalId = randomUUID();
    const occurrenceInternalId = randomUUID();
    const now = new Date();

    const series: MeetingSeriesRecord = {
      id: seriesInternalId,
      seriesId: params.series.seriesId,
      organizationId: params.series.organizationId ?? null,
      teamId: params.series.teamId ?? null,
      createdBy: params.series.createdBy,
      title: params.series.title,
      description: params.series.description ?? null,
      durationMinutes: params.series.durationMinutes,
      privacy: params.series.privacy,
      timeZone: params.series.timeZone,
      localStartDate: params.series.localStartDate,
      localStartTime: params.series.localStartTime,
      recurrenceRule: params.series.recurrenceRule,
      status: 'ACTIVE',
      revision: 1,
      materializedThrough: params.firstOccurrence.scheduledAt,
      createdAt: now,
      updatedAt: now,
    };

    const firstOccurrence: MeetingOccurrenceRecord = {
      id: occurrenceInternalId,
      meetingId: params.firstOccurrence.meetingId,
      organizationId: params.series.organizationId ?? null,
      teamId: params.series.teamId ?? null,
      createdBy: params.series.createdBy,
      title: params.firstOccurrence.title ?? params.series.title,
      description: params.firstOccurrence.description ?? params.series.description ?? null,
      privacy: params.firstOccurrence.privacy ?? params.series.privacy,
      seriesId: seriesInternalId,
      occurrenceKey: params.firstOccurrence.occurrenceKey,
      scheduledAt: params.firstOccurrence.scheduledAt,
      eventTimeZone: params.firstOccurrence.eventTimeZone,
      durationMinutes: params.firstOccurrence.durationMinutes,
      status: 'scheduled',
      lifecycleRevision: 1,
      roomId: null,
      createdAt: now,
    };

    this.seriesStore.set(series.id, series);
    this.occurrenceStore.set(firstOccurrence.id, firstOccurrence);

    return { series, firstOccurrence };
  }

  async findSeriesById(
    seriesId: string,
    tenant: TenantContext
  ): Promise<MeetingSeriesRecord | null> {
    for (const record of this.seriesStore.values()) {
      if ((record.seriesId === seriesId || record.id === seriesId) && this.matchesTenant(record, tenant)) {
        return { ...record };
      }
    }
    return null;
  }

  async findOccurrenceByKey(
    seriesId: string,
    occurrenceKey: string,
    tenant: TenantContext
  ): Promise<MeetingOccurrenceRecord | null> {
    const series = await this.findSeriesById(seriesId, tenant);
    if (!series) return null;

    for (const record of this.occurrenceStore.values()) {
      if (
        record.seriesId === series.id &&
        record.occurrenceKey === occurrenceKey &&
        this.matchesTenant(record, tenant)
      ) {
        return { ...record };
      }
    }
    return null;
  }

  async findMeetingById(
    meetingId: string,
    tenant: TenantContext
  ): Promise<MeetingOccurrenceRecord | null> {
    for (const record of this.occurrenceStore.values()) {
      if ((record.meetingId === meetingId || record.id === meetingId) && this.matchesTenant(record, tenant)) {
        return { ...record };
      }
    }
    return null;
  }

  async listOccurrencesByWindow(params: {
    fromInclusive: Date;
    toExclusive: Date;
    tenant: TenantContext;
    seriesId?: string;
  }): Promise<readonly MeetingOccurrenceRecord[]> {
    const results: MeetingOccurrenceRecord[] = [];
    const fromTime = params.fromInclusive.getTime();
    const toTime = params.toExclusive.getTime();

    for (const record of this.occurrenceStore.values()) {
      if (!this.matchesTenant(record, params.tenant)) continue;
      if (params.seriesId && record.seriesId !== params.seriesId) continue;

      const schedTime = record.scheduledAt.getTime();
      if (schedTime >= fromTime && schedTime < toTime) {
        results.push({ ...record });
      }
    }

    return results.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  async upsertOccurrence(params: {
    seriesId: string;
    seed: CreateOccurrenceSeedParams;
    tenant: TenantContext;
  }): Promise<{ occurrence: MeetingOccurrenceRecord; created: boolean }> {
    const existing = await this.findOccurrenceByKey(params.seriesId, params.seed.occurrenceKey, params.tenant);
    if (existing) {
      return { occurrence: existing, created: false };
    }

    const series = await this.findSeriesById(params.seriesId, params.tenant);
    if (!series) {
      throw new Error(`SERIES_NOT_FOUND: ${params.seriesId}`);
    }

    const occurrence: MeetingOccurrenceRecord = {
      id: randomUUID(),
      meetingId: params.seed.meetingId,
      organizationId: series.organizationId,
      teamId: series.teamId,
      createdBy: series.createdBy,
      title: params.seed.title ?? series.title,
      description: params.seed.description ?? series.description,
      privacy: params.seed.privacy ?? series.privacy,
      seriesId: series.id,
      occurrenceKey: params.seed.occurrenceKey,
      scheduledAt: params.seed.scheduledAt,
      eventTimeZone: params.seed.eventTimeZone,
      durationMinutes: params.seed.durationMinutes,
      status: 'scheduled',
      lifecycleRevision: 1,
      roomId: null,
      createdAt: new Date(),
    };

    this.occurrenceStore.set(occurrence.id, occurrence);
    return { occurrence, created: true };
  }

  async createException(params: {
    seriesId: string;
    occurrenceKey: string;
    kind: 'CANCELLED' | 'OVERRIDDEN';
    overrideMeetingId?: string | null;
    seriesRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingRecurrenceExceptionRecord> {
    const series = await this.findSeriesById(params.seriesId, params.tenant);
    if (!series) {
      throw new Error(`SERIES_NOT_FOUND: ${params.seriesId}`);
    }

    const existing = this.exceptionsStore.find(
      (e) => e.seriesId === series.id && e.occurrenceKey === params.occurrenceKey
    );
    if (existing) {
      throw new Error(`EXCEPTION_ALREADY_EXISTS: ${params.occurrenceKey}`);
    }

    const record: MeetingRecurrenceExceptionRecord = {
      id: randomUUID(),
      seriesId: series.id,
      occurrenceKey: params.occurrenceKey,
      kind: params.kind,
      overrideMeetingId: params.overrideMeetingId ?? null,
      seriesRevision: params.seriesRevision,
      createdAt: new Date(),
    };

    this.exceptionsStore.push(record);
    return record;
  }

  async findExceptionsBySeries(
    seriesId: string,
    tenant: TenantContext
  ): Promise<readonly MeetingRecurrenceExceptionRecord[]> {
    const series = await this.findSeriesById(seriesId, tenant);
    if (!series) return [];

    return this.exceptionsStore
      .filter((e) => e.seriesId === series.id)
      .map((e) => ({ ...e }));
  }

  async updateSeriesStatus(params: {
    seriesId: string;
    status: MeetingSeriesStatus;
    expectedRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingSeriesRecord> {
    const series = await this.findSeriesById(params.seriesId, params.tenant);
    if (!series) {
      throw new Error(`SERIES_NOT_FOUND: ${params.seriesId}`);
    }

    if (series.revision !== params.expectedRevision) {
      throw new Error(`SERIES_REVISION_CONFLICT: expected ${params.expectedRevision}, found ${series.revision}`);
    }

    const updated: MeetingSeriesRecord = {
      ...series,
      status: params.status,
      revision: series.revision + 1,
      updatedAt: new Date(),
    };

    this.seriesStore.set(series.id, updated);
    return updated;
  }

  async updateMeetingStatus(params: {
    meetingId: string;
    status: MeetingLifecycleStatus;
    expectedRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingOccurrenceRecord> {
    const meeting = await this.findMeetingById(params.meetingId, params.tenant);
    if (!meeting) {
      throw new Error(`MEETING_NOT_FOUND: ${params.meetingId}`);
    }

    if (meeting.lifecycleRevision !== params.expectedRevision) {
      throw new Error(
        `MEETING_REVISION_CONFLICT: expected ${params.expectedRevision}, found ${meeting.lifecycleRevision}`
      );
    }

    const updated: MeetingOccurrenceRecord = {
      ...meeting,
      status: params.status,
      lifecycleRevision: meeting.lifecycleRevision + 1,
    };

    this.occurrenceStore.set(meeting.id, updated);
    return updated;
  }
}
