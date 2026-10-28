/**
 * MLTR-05: Series Splitter
 * Implements RFC 5545 series splitting for 'following' mutation scope.
 * Invariant: Old series rule terminates immediately before split key; successor series starts at split key.
 */

import { MeetingSeriesRecord } from './repositories/meeting-repository.types.js';

export interface SplitSeriesPlan {
  /**
   * Updated recurrence rule for the existing (predecessor) series with UNTIL capped before split.
   */
  cappedPredecessorRule: string;

  /**
   * Local start date for the successor series.
   */
  successorStartDate: string;

  /**
   * Local start time for the successor series.
   */
  successorStartTime: string;

  /**
   * Recurrence rule for the successor series.
   */
  successorRule: string;
}

export class SeriesSplitter {
  /**
   * Splits a series at a target occurrence.
   *
   * @param series - The active predecessor series
   * @param targetOccurrenceKey - The key (YYYY-MM-DDTHH:mm:ss) of the first occurrence of the successor series
   * @param splitInstant - The UTC instant of the target occurrence
   * @param updatedSuccessorRule - Optional new recurrence rule for the successor series
   */
  static planSplit(params: {
    series: MeetingSeriesRecord;
    targetOccurrenceKey: string;
    splitInstant: Date;
    updatedSuccessorRule?: string;
  }): SplitSeriesPlan {
    const { series, targetOccurrenceKey, splitInstant, updatedSuccessorRule } = params;

    // 1. Capped predecessor UNTIL instant (1 second prior to split instant)
    const untilDate = new Date(splitInstant.getTime() - 1000);
    const untilUtc = this.formatIcalUtc(untilDate);

    // Strip any existing UNTIL or COUNT from predecessor rule
    let baseRule = series.recurrenceRule
      .replace(/;?UNTIL=[^;]+/gi, '')
      .replace(/;?COUNT=\d+/gi, '');

    const cappedPredecessorRule = `${baseRule};UNTIL=${untilUtc}`;

    // 2. Successor series local anchor
    const [successorStartDate, successorStartTime] = targetOccurrenceKey.split('T');

    // 3. Successor rule (defaults to original base rule unless updated)
    const successorRule = updatedSuccessorRule || baseRule;

    return {
      cappedPredecessorRule,
      successorStartDate,
      successorStartTime,
      successorRule,
    };
  }

  /**
   * Formats a JS Date to iCalendar UTC format: YYYYMMDDTHHmmssZ
   */
  private static formatIcalUtc(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = d.getUTCFullYear();
    const m = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    const h = pad(d.getUTCHours());
    const min = pad(d.getUTCMinutes());
    const s = pad(d.getUTCSeconds());
    return `${y}${m}${day}T${h}${min}${s}Z`;
  }
}
