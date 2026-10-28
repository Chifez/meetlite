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
  UpdateOccurrenceParams,
  UpdateSeriesAndOccurrencesParams,
  SplitSeriesAtOccurrenceParams,
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
   * Upserts an occurrence for rolling materialization or standalone creation.
   * Idempotent on (seriesId, occurrenceKey) or meetingId.
   */
  upsertOccurrence(params: {
    seriesId?: string | null;
    seed: CreateOccurrenceSeedParams;
    tenant: TenantContext;
    createdBy?: string;
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

  /**
   * Advances the materializedThrough timestamp of a series.
   */
  advanceMaterializedThrough(
    seriesId: string,
    throughExclusive: Date,
    tenant?: TenantContext
  ): Promise<void>;

  /**
   * Finds active series whose materializedThrough is null or earlier than horizon.
   */
  findDueSeriesForMaterialization(
    horizon: Date,
    limit: number
  ): Promise<readonly MeetingSeriesRecord[]>;

  /**
   * MLTR-05: Updates a single occurrence with lifecycleRevision concurrency check.
   */
  updateMeetingOccurrence(
    params: UpdateOccurrenceParams
  ): Promise<MeetingOccurrenceRecord>;

  /**
   * MLTR-05: Cancels a single occurrence with lifecycleRevision concurrency check.
   */
  cancelMeetingOccurrence(params: {
    meetingId: string;
    expectedRevision: number;
    tenant: TenantContext;
  }): Promise<MeetingOccurrenceRecord>;

  /**
   * MLTR-05: Cancels an entire series and all future scheduled occurrences with revision concurrency check.
   */
  cancelSeries(params: {
    seriesId: string;
    expectedRevision: number;
    tenant: TenantContext;
  }): Promise<{ series: MeetingSeriesRecord; cancelledOccurrencesCount: number }>;

  /**
   * MLTR-05: Cancels occurrences starting from split occurrence key and caps the series rule.
   */
  cancelFollowingOccurrences(params: {
    seriesId: string;
    fromOccurrenceKey: string;
    expectedRevision: number;
    cappedRule: string;
    tenant: TenantContext;
  }): Promise<{ series: MeetingSeriesRecord; cancelledOccurrencesCount: number }>;

  /**
   * MLTR-05: Updates series definition and propagates common fields to future scheduled occurrences.
   */
  updateSeriesAndOccurrences(
    params: UpdateSeriesAndOccurrencesParams
  ): Promise<{ series: MeetingSeriesRecord; updatedOccurrencesCount: number }>;

  /**
   * MLTR-05: Splits a series into predecessor (capped) and successor series starting at target occurrence.
   */
  splitSeriesAtOccurrence(
    params: SplitSeriesAtOccurrenceParams
  ): Promise<{
    predecessorSeries: MeetingSeriesRecord;
    successorSeries: MeetingSeriesRecord;
    updatedMeeting: MeetingOccurrenceRecord;
  }>;
}
