/**
 * MLTR-02: Outbox Repository Interface
 * Invariant: Asynchronous side effects are transactionally committed with domain state.
 */

import { OutboxEventRecord, AppendOutboxParams } from './meeting-repository.types.js';

export interface OutboxRepository {
  /**
   * Appends an outbox event.
   */
  append(params: AppendOutboxParams): Promise<OutboxEventRecord>;

  /**
   * Fetches unpublished events in chronological order for publishing.
   */
  fetchUnpublished(limit: number): Promise<readonly OutboxEventRecord[]>;

  /**
   * Marks an event as published.
   */
  markPublished(eventId: string, publishedAt?: Date): Promise<void>;

  /**
   * Records a failed publication attempt with error code.
   */
  recordAttempt(eventId: string, lastErrorCode: string): Promise<void>;
}
