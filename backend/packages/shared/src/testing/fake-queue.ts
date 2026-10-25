export interface FakeJob<T = unknown> {
  id: string;
  name: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'dead_letter';
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

/**
 * Deterministic In-Memory Queue Fake.
 * Simulates BullMQ job queues without requiring a running Redis instance.
 */
export class FakeQueue<T = unknown> {
  private jobs = new Map<string, FakeJob<T>>();
  private jobCounter = 0;

  async add(name: string, data: T, opts?: { jobId?: string; attempts?: number }): Promise<FakeJob<T>> {
    const id = opts?.jobId || `job_${++this.jobCounter}`;

    // Idempotency: if job with same ID already exists, do not duplicate
    if (this.jobs.has(id)) {
      return this.jobs.get(id)!;
    }

    const job: FakeJob<T> = {
      id,
      name,
      data,
      attempts: 0,
      maxAttempts: opts?.attempts ?? 3,
      status: 'waiting',
      createdAt: new Date(),
    };

    this.jobs.set(id, job);
    return job;
  }

  async processNext(handler: (data: T) => Promise<void>): Promise<FakeJob<T> | null> {
    const nextJob = Array.from(this.jobs.values()).find((j) => j.status === 'waiting');
    if (!nextJob) return null;

    nextJob.status = 'active';
    nextJob.attempts += 1;

    try {
      await handler(nextJob.data);
      nextJob.status = 'completed';
      nextJob.processedAt = new Date();
    } catch (err: any) {
      nextJob.error = err.message || String(err);
      if (nextJob.attempts >= nextJob.maxAttempts) {
        nextJob.status = 'dead_letter';
      } else {
        nextJob.status = 'waiting'; // Retriable
      }
    }

    return nextJob;
  }

  getJob(id: string): FakeJob<T> | undefined {
    return this.jobs.get(id);
  }

  getJobsByStatus(status: FakeJob['status']): FakeJob<T>[] {
    return Array.from(this.jobs.values()).filter((j) => j.status === status);
  }

  clear(): void {
    this.jobs.clear();
    this.jobCounter = 0;
  }
}
