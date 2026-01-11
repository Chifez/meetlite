import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { encryptJobData, decryptJobData } from '../utils/encryption.js';
import { createJobOptions, formatJobId } from '../utils/job-helpers.js';

/**
 * Base Queue Class
 * Abstract base class for all queue types
 * Handles Redis connection, encryption, and common queue operations
 */
export class BaseQueue {
  constructor(queueName, options = {}) {
    if (this.constructor === BaseQueue) {
      throw new Error(
        'BaseQueue is abstract and cannot be instantiated directly'
      );
    }

    this.queueName = queueName;
    this.options = options;
    this.connection = null;
    this.queue = null;
    this.eventListeners = new Map();

    this.initializeConnection();
    this.initializeQueue();
    this.setupEventListeners();
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
  initializeQueue() {
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
  setupEventListeners() {
    this.queue.on('error', (error) => {
      console.error(`Queue ${this.queueName} error:`, error);
    });

    this.queue.on('waiting', (jobId) => {
      console.log(`Job ${jobId} is waiting in ${this.queueName}`);
    });

    this.queue.on('active', (job) => {
      console.log(
        `Processing job ${job.id}: ${job.name} in ${this.queueName}`
      );
    });

    this.queue.on('completed', (job) => {
      console.log(
        `Job ${job.id} completed successfully in ${this.queueName}`
      );
    });

    this.queue.on('failed', (job, error) => {
      console.error(
        `Job ${job?.id} failed in ${this.queueName}:`,
        error.message
      );
    });

    this.queue.on('stalled', (jobId) => {
      console.warn(`Job ${jobId} stalled in ${this.queueName}`);
    });
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(handler);
    this.queue.on(event, handler);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        this.queue.off(event, handler);
      }
    }
  }

  /**
   * Add a job to the queue with encryption
   * @param {string} type - Job type
   * @param {object} data - Job data (will be encrypted)
   * @param {object} options - Job options
   * @returns {Promise<Job>}
   */
  async addJob(type, data, options = {}) {
    try {
      // Encrypt sensitive data
      const encryptedData = encryptJobData(data);

      // Format job ID if not provided
      const jobId = options.jobId || formatJobId(type, data.id || Date.now());

      // Add job to queue
      const job = await this.queue.add(
        type,
        {
          encrypted: true,
          ...encryptedData,
        },
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
   * @param {string} type - Job type
   * @param {object} data - Job data
   * @param {object} options - Job options
   * @returns {Promise<Job>}
   */
  async addJobUnencrypted(type, data, options = {}) {
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
   * @param {string} jobId - Job ID
   * @returns {Promise<Job|null>}
   */
  async getJob(jobId) {
    return await this.queue.getJob(jobId);
  }

  /**
   * Cancel a job
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>}
   */
  async cancelJob(jobId) {
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
   * @returns {Promise<object>}
   */
  async getStats() {
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
   * @param {object} jobData - Encrypted job data
   * @returns {object} Decrypted data
   */
  decryptJobData(jobData) {
    if (jobData.encrypted) {
      return decryptJobData(jobData);
    }
    return jobData;
  }

  /**
   * Close the queue and connection
   * @returns {Promise<void>}
   */
  async close() {
    console.log(`Closing ${this.queueName} queue...`);
    await this.queue.close();
    await this.connection.quit();
  }

  /**
   * Get the underlying BullMQ queue instance
   * @returns {Queue}
   */
  getQueue() {
    return this.queue;
  }

  /**
   * Get the Redis connection
   * @returns {Redis}
   */
  getConnection() {
    return this.connection;
  }
}
