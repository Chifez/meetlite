/**
 * MLTR-07: Outbox Publisher Service
 * Invariant: Every committed meeting change has a durable, idempotent delivery intent.
 * Claims unpublished outbox rows in bounded batches, dispatches them, and marks them published.
 */

import { OutboxRepository } from '../repositories/outbox.repository.js';
import { OutboxEventRecord } from '../repositories/meeting-repository.types.js';

export interface EventDispatcher {
  dispatch(event: OutboxEventRecord): Promise<void>;
}

export interface PublishBatchResult {
  processed: number;
  published: number;
  failed: number;
}

export class OutboxPublisher {
  constructor(
    private readonly outboxRepo: OutboxRepository,
    private readonly dispatcher: EventDispatcher
  ) {}

  /**
   * Processes a bounded batch of unpublished outbox events idempotently.
   */
  async publishBatch(batchSize = 50): Promise<PublishBatchResult> {
    const events = await this.outboxRepo.fetchUnpublished(batchSize);
    let published = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.dispatcher.dispatch(event);
        await this.outboxRepo.markPublished(event.eventId);
        published += 1;
      } catch (err: any) {
        const errorCode = err.code || err.name || 'DISPATCH_ERROR';
        await this.outboxRepo.recordAttempt(event.eventId, errorCode);
        failed += 1;
      }
    }

    return {
      processed: events.length,
      published,
      failed,
    };
  }
}
