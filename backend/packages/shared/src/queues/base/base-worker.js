import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { handleJobError } from '../utils/job-helpers.js';

/**
 * Base Worker Class
 * Abstract base class for all workers
 * Handles job processing lifecycle, error handling, and graceful shutdown
 */
export class BaseWorker {
  constructor(queueName, processJob, options = {}) {
    if (this.constructor === BaseWorker) {
      throw new Error(
        'BaseWorker is abstract and cannot be instantiated directly'
      );
    }

    this.queueName = queueName;
    this.processJob = processJob;
    this.options = options;
    this.connection = null;
    this.worker = null;
    this.isShuttingDown = false;

    this.initializeConnection();
    this.initializeWorker();
    this.setupEventListeners();
    this.setupGracefulShutdown();
  }

  /**
   * Initialize Redis connection
   */
  initializeConnection() {
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
  initializeWorker() {
    const prefix = this.options.prefix || `bull:${this.queueName}`;
    const concurrency =
      this.options.concurrency ||
      parseInt(process.env.QUEUE_CONCURRENCY || '5');
    const limiter = this.options.limiter || {
      max: parseInt(process.env.QUEUE_RATE_LIMIT || '100'),
      duration: 60000, // Per minute
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
        connection: this.connection,
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
  setupEventListeners() {
    this.worker.on('completed', (job, result) => {
      if (result?.skipped) {
        console.log(`⏭️  Job ${job.id} skipped: ${result.reason}`);
      } else if (result?.success) {
        console.log(`✅ Job ${job.id} completed successfully`);
      } else {
        console.log(`✅ Job ${job.id} completed`);
      }
    });

    this.worker.on('failed', (job, error) => {
      const errorInfo = handleJobError(error, job);
      console.error(`❌ Job ${job?.id} failed:`, errorInfo);
    });

    this.worker.on('error', (error) => {
      console.error(`❌ Worker error for ${this.queueName}:`, error);
    });

    this.worker.on('ready', () => {
      console.log(`✅ ${this.queueName} worker ready and listening for jobs`);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`⚠️  Job ${jobId} stalled in ${this.queueName} worker`);
    });

    this.worker.on('progress', (job, progress) => {
      console.log(`📊 Job ${job.id} progress: ${progress}%`);
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) {
        return;
      }

      this.isShuttingDown = true;
      console.log(
        `⏹️  Received ${signal}, shutting down ${this.queueName} worker...`
      );

      try {
        // Wait for current jobs to complete (with timeout)
        await Promise.race([
          this.worker.close(),
          new Promise((resolve) => setTimeout(resolve, 10000)), // 10 second timeout
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
   * @returns {Promise<object>}
   */
  async getStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.worker.getWaitingCount(),
        this.worker.getActiveCount(),
        this.worker.getCompletedCount(),
        this.worker.getFailedCount(),
        this.worker.getDelayedCount(),
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
      console.error(
        `❌ Failed to get worker stats for ${this.queueName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Close the worker and connection
   * @returns {Promise<void>}
   */
  async close() {
    this.isShuttingDown = true;
    await this.worker.close();
    await this.connection.quit();
  }

  /**
   * Get the underlying BullMQ worker instance
   * @returns {Worker}
   */
  getWorker() {
    return this.worker;
  }

  /**
   * Get the Redis connection
   * @returns {Redis}
   */
  getConnection() {
    return this.connection;
  }
}
