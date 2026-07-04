import { Queue, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { encryptJobData, decryptJobData } from '../utils/encryption.js';
import { createJobOptions, formatJobId } from '../utils/job-helpers.js';

/**
 * Base Queue Class
 * Abstract base class for all queue types
 * Handles Redis connection, encryption, and common queue operations
 */
export abstract class BaseQueue {
  protected queueName: string;
  protected options: Record<string, any>;
  protected connection!: Redis;
  protected queue!: Queue;
  protected eventListeners: Map<string, any[]>;

  constructor(queueName: string, options: Record<string, any> = {}) {
    this.queueName = queueName;
    this.options = options;
    this.eventListeners = new Map<string, any[]>();

    this.initializeConnection();
    this.initializeQueue();
    this.setupEventListeners();
  }

  /**
   * Initialize Redis connection
   */
  private initializeConnection(): void {
    const db = this.options.db || parseInt(process.env.BULL_REDIS_DB || '0');

    this.connection = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      ...(process.env.NODE_ENV === 'production' &&
        process.env.REDIS_TLS === 'true' && {
          tls: {
            rejectUnauthorized: true,
          },
        }),
      ...this.options.redisOptions,
    });

    this.connection.on('error', (error) => {
      console.error(`Redis connection error for ${this.queueName}:`, error);
    });

    this.connection.on('connect', () => {
      console.log(`Redis connected for ${this.queueName}`);
    });
  }

  /**
   * Initialize BullMQ queue
   */
  private initializeQueue(): void {
    const prefix = this.options.prefix || `bull:${this.queueName}`;
    const defaultJobOptions =
      this.options.defaultJobOptions || createJobOptions();

    this.queue = new Queue(this.queueName, {
      connection: this.connection,
      prefix,
      defaultJobOptions,
    });
  }

  /**
   * Setup default event listeners
   */
  private setupEventListeners(): void {
    (this.queue as any).on('error', (error: any) => {
      console.error(`Queue ${this.queueName} error:`, error);
    });

    (this.queue as any).on('waiting', (jobId: any) => {
      console.log(`Job ${jobId} is waiting in ${this.queueName}`);
    });

    (this.queue as any).on('active', (job: any) => {
      console.log(
        `Processing job ${job.id}: ${job.name} in ${this.queueName}`
      );
    });

    (this.queue as any).on('completed', (job: any) => {
      console.log(
        `Job ${job.id} completed successfully in ${this.queueName}`
      );
    });

    (this.queue as any).on('failed', (job: any, error: any) => {
      console.error(
        `Job ${job?.id} failed in ${this.queueName}:`,
        error.message
      );
    });

    (this.queue as any).on('stalled', (jobId: any) => {
      console.warn(`Job ${jobId} stalled in ${this.queueName}`);
    });
  }

  /**
   * Add event listener
   * @param event - Event name
   * @param handler - Event handler
   */
  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
    (this.queue as any).on(event, handler);
  }

  /**
   * Remove event listener
   * @param event - Event name
   * @param handler - Event handler
   */
  off(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        (this.queue as any).off(event, handler);
      }
    }
  }

  /**
   * Add a job to the queue with encryption
   * @param type - Job type
   * @param data - Job data (will be encrypted)
   * @param options - Job options
   * @returns Job details
   */
  async addJob(type: string, data: any, options: Record<string, any> = {}): Promise<Job> {
    try {
      const encryptedData = encryptJobData(data);
      const jobId = options.jobId || formatJobId(type, data.id || Date.now());

      const payload = Object.assign({ encrypted: true }, encryptedData);

      const job = await this.queue.add(
        type,
        payload,
        {
          ...options,
          jobId,
        }
      );

      console.log(`Added job ${job.id} to ${this.queueName} queue`);
      return job;
    } catch (error) {
      console.error(`Failed to add job to ${this.queueName}:`, error);
      throw error;
    }
  }

  /**
   * Add a job without encryption (for non-sensitive data)
   * @param type - Job type
   * @param data - Job data
   * @param options - Job options
   * @returns Job details
   */
  async addJobUnencrypted(type: string, data: any, options: Record<string, any> = {}): Promise<Job> {
    try {
      const jobId = options.jobId || formatJobId(type, data.id || Date.now());

      const job = await this.queue.add(type, data, {
        ...options,
        jobId,
      });

      console.log(
        `Added unencrypted job ${job.id} to ${this.queueName} queue`
      );
      return job;
    } catch (error) {
      console.error(
        `Failed to add unencrypted job to ${this.queueName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<Job | undefined> {
    return await this.queue.getJob(jobId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        console.warn(`Job ${jobId} not found in ${this.queueName}`);
        return false;
      }

      const state = await job.getState();
      if (state === 'completed' || state === 'failed') {
        console.warn(`Job ${jobId} already ${state}`);
        return false;
      }

      await job.remove();
      console.log(`Cancelled job ${jobId} in ${this.queueName}`);
      return true;
    } catch (error) {
      console.error(
        `Failed to cancel job ${jobId} in ${this.queueName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<Record<string, number> | null> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (error) {
      console.error(`Failed to get stats for ${this.queueName}:`, error);
      return null;
    }
  }

  /**
   * Decrypt job data (for use in workers)
   */
  decryptJobData(jobData: any): any {
    if (jobData.encrypted) {
      return decryptJobData(jobData);
    }
    return jobData;
  }

  /**
   * Close the queue and connection
   */
  async close(): Promise<void> {
    console.log(`Closing ${this.queueName} queue...`);
    await this.queue.close();
    await this.connection.quit();
  }

  /**
   * Get the underlying BullMQ queue instance
   */
  getQueue(): Queue {
    return this.queue;
  }

  /**
   * Get the Redis connection
   */
  getConnection(): Redis {
    return this.connection;
  }
}
