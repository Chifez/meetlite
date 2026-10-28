import logger from '../utils/logger.js';

export interface RecurrenceMetricEvent {
  metric:
    | 'meeting_series_create_total'
    | 'meeting_recurrence_expand_total'
    | 'meeting_recurrence_occurrences_created_total'
    | 'meeting_recurrence_duplicate_conflict_total';
  result: 'success' | 'failure';
  errorCode?: string;
  meetingId?: string;
  seriesId?: string;
  count?: number;
  durationMs?: number;
}

/**
 * Structured Recurrence Telemetry & Metrics
 * Follows section 13 of the meeting lifecycle implementation plan.
 */
export class RecurrenceMetrics {
  static record(event: RecurrenceMetricEvent): void {
    logger.info('[Metric] Recurrence telemetry event', {
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  static recordFailure(
    metric: RecurrenceMetricEvent['metric'],
    errorCode: string,
    metadata: {
      meetingId?: string;
      seriesId?: string;
      error?: any;
      durationMs?: number;
    } = {}
  ): void {
    logger.error('[Metric] Recurrence failure', {
      metric,
      result: 'failure',
      errorCode,
      meetingId: metadata.meetingId,
      seriesId: metadata.seriesId,
      errorMessage: metadata.error instanceof Error ? metadata.error.message : String(metadata.error),
      durationMs: metadata.durationMs,
      timestamp: new Date().toISOString(),
    });
  }
}
