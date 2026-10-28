/**
 * MLTR-02: Meeting Repository Interface
 * Invariant: Series templates and joinable occurrences are distinguishable in storage.
 */

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

export interface MeetingRepository {
  /**
   * Atomically commits a series template and its very first joinable occurrence.
   * Series is a template; occurrence is a joinable entity.
   */
  createSeriesWithFirstOccurrence(
    params: CreateSeriesWithFirstOccurrenceParams
  ): Promise<{
    series: MeetingSeriesRecord;
    firstOccurrence: MeetingOccurrenceRecord;
  }>;

  /**
   * Retrieves a series template by its public seriesId within tenant bounds.
   */
  findSeriesById(
    seriesId: string,
    tenant: TenantContext
  ): Promise<MeetingSeriesRecord | null>;

  /**
   * Retrieves a specific occurrence by its seriesId and occurrenceKey within tenant bounds.
   */
  findOccurrenceByKey(
    seriesId: string,
    occurrenceKey: string,
    tenant: TenantContext
  ): Promise<MeetingOccurrenceRecord | null>;

  /**
   * Retrieves a meeting occurrence by its public meetingId within tenant bounds.
   */
  findMeetingById(
    meetingId: string,
    tenant: TenantContext
  ): Promise<MeetingOccurrenceRecord | null>;

  /**
   * Lists occurrences in a bounded time window (occurrences only; never templates).
   */
  listOccurrencesByWindow(params: {
    fromInclusive: Date;
    toExclusive: Date;
    tenant: TenantContext;
    seriesId?: string;
  }): Promise<readonly MeetingOccurrenceRecord[]>;

  /**
   * Upserts an occurrence for rolling materialization. Idempotent on (seriesId, occurrenceKey).
   */
  upsertOccurrence(params: {
    seriesId: string;
    seed: CreateOccurrenceSeedParams;
    tenant: TenantContext;
  }): Promise<{ occurrence: MeetingOccurrenceRecord; created: boolean }>;

  /**
   * Creates an exception for an occurrence (e.g. CANCELLED or OVERRIDDEN).
   */
  createException(params: {
    seriesId: string;
    occurrenceKey: string;
    kind: 'CANCELLED' | 'OVERRIDDEN';
    overrideMeetingId?: string | null;
    seriesRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingRecurrenceExceptionRecord>;

  /**
   * Retrieves all exceptions for a series.
   */
  findExceptionsBySeries(
    seriesId: string,
    tenant: TenantContext
  ): Promise<readonly MeetingRecurrenceExceptionRecord[]>;

  /**
   * Updates series status with revision concurrency check.
   */
  updateSeriesStatus(params: {
    seriesId: string;
    status: MeetingSeriesStatus;
    expectedRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingSeriesRecord>;

  /**
   * Updates meeting occurrence lifecycle status with revision concurrency check.
   */
  updateMeetingStatus(params: {
    meetingId: string;
    status: MeetingLifecycleStatus;
    expectedRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingOccurrenceRecord>;
}
