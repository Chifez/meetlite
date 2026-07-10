import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { handleJobError } from '../utils/job-helpers.js';

/**
 * Base Worker Class
 * Abstract base class for all workers
 * Handles job processing lifecycle, error handling, and graceful shutdown
 */
export abstract class BaseWorker {
  protected queueName: string;
  protected processJob: (job: Job) => Promise<any>;
  protected options: Record<string, any>;
  protected connection!: Redis;
  protected worker!: Worker;
  protected isShuttingDown: boolean;

  constructor(queueName: string, processJob: (job: Job) => Promise<any>, options: Record<string, any> = {}) {
    this.queueName = queueName;
    this.processJob = processJob;
    this.options = options;
    this.isShuttingDown = false;

    this.initializeConnection();
    this.initializeWorker();
    this.setupEventListeners();
    this.setupGracefulShutdown();
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
      maxRetriesPerRequest: null,
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
      console.error(
        `❌ Redis connection error for ${this.queueName} worker:`,
        error
      );
    });
  }

  /**
   * Initialize BullMQ worker
   */
  private initializeWorker(): void {
    const prefix = this.options.prefix || `bull:${this.queueName}`;
    const concurrency =
      this.options.concurrency ||
      parseInt(process.env.QUEUE_CONCURRENCY || '5');
    const limiter = this.options.limiter || {
      max: parseInt(process.env.QUEUE_RATE_LIMIT || '100'),
      duration: 60000,
    };

    this.worker = new Worker(
      this.queueName,
      async (job) => {
        if (this.isShuttingDown) {
          throw new Error('Worker is shutting down');
        }
        return await this.processJob(job);
      },
      {
        connection: this.connection as any,
        prefix,
        concurrency,
        limiter,
        ...this.options.workerOptions,
      }
    );
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.worker.on('completed', (job: Job, result: any) => {
      if (result?.skipped) {
        console.log(`⏭️  Job ${job.id} skipped: ${result.reason}`);
      } else if (result?.success) {
        console.log(`✅ Job ${job.id} completed successfully`);
      } else {
        console.log(`✅ Job ${job.id} completed`);
      }
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      const errorInfo = handleJobError(error, job as any);
      console.error(`❌ Job ${job?.id} failed:`, errorInfo);
    });

    this.worker.on('error', (error: Error) => {
      console.error(`❌ Worker error for ${this.queueName}:`, error);
    });

    this.worker.on('ready', () => {
      console.log(`✅ ${this.queueName} worker ready and listening for jobs`);
    });

    this.worker.on('stalled', (jobId: string) => {
      console.warn(`⚠️  Job ${jobId} stalled in ${this.queueName} worker`);
    });

    this.worker.on('progress', (job: Job, progress: any) => {
      console.log(`📊 Job ${job.id} progress: ${progress}%`);
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        return;
      }

      this.isShuttingDown = true;
      console.log(
        `⏹️  Received ${signal}, shutting down ${this.queueName} worker...`
      );

      try {
        await Promise.race([
          this.worker.close(),
          new Promise((resolve) => setTimeout(resolve, 10000)),
        ]);

        await this.connection.quit();
        console.log(`✅ ${this.queueName} worker shut down gracefully`);
        process.exit(0);
      } catch (error) {
        console.error(
          `❌ Error during ${this.queueName} worker shutdown:`,
          error
        );
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get worker statistics
   */
  async getStats(): Promise<Record<string, number> | null> {
    try {
      return null;
    } catch (error) {
      console.error(
        `❌ Failed to get worker stats for ${this.queueName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Close the worker and connection
   */
  async close(): Promise<void> {
    this.isShuttingDown = true;
    await this.worker.close();
    await this.connection.quit();
  }

  /**
   * Get the underlying BullMQ worker instance
   */
  getWorker(): Worker {
    return this.worker;
  }

  /**
   * Get the Redis connection
   */
  getConnection(): Redis {
    return this.connection;
  }
}
