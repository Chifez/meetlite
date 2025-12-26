import { Queue } from 'bullmq';
import Redis from 'ioredis';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Notification Queue using BullMQ
 * Handles delayed notification jobs with encryption for security
 */

// Create separate Redis connection for BullMQ
const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.BULL_REDIS_DB || '0'),
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  // TLS for production
  ...(process.env.NODE_ENV === 'production' &&
    process.env.REDIS_TLS === 'true' && {
      tls: {
        rejectUnauthorized: true,
      },
    }),
});

// Encryption utilities
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

if (ENCRYPTION_KEY.length !== 32) {
  console.error(
    '⚠️  ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
  );
  throw new Error('Invalid ENCRYPTION_KEY configuration');
}

/**
 * Encrypt sensitive job data before storing in Redis
 */
export const encryptJobData = (data) => {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    const jsonData = JSON.stringify(data);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Failed to encrypt job data');
  }
};

/**
 * Decrypt job data retrieved from Redis
 */
export const decryptJobData = (encryptedData) => {
  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      ENCRYPTION_KEY,
      Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('❌ Decryption error:', error);
    throw new Error('Failed to decrypt job data');
  }
};

/**
 * Notification Queue Configuration
 */
export const notificationQueue = new Queue('notifications', {
  connection,
  prefix: 'bull:notifications',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    },
  },
});

// Queue event listeners
notificationQueue.on('error', (error) => {
  console.error('❌ Notification queue error:', error);
});

notificationQueue.on('waiting', (jobId) => {
  console.log(`⏳ Job ${jobId} is waiting`);
});

notificationQueue.on('active', (job) => {
  console.log(`⚙️  Processing job ${job.id}: ${job.name}`);
});

notificationQueue.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

notificationQueue.on('failed', (job, error) => {
  console.error(`❌ Job ${job?.id} failed:`, error.message);
});

/**
 * Add a notification job to the queue
 * @param {string} type - Job type (e.g., 'meeting_reminder')
 * @param {object} data - Job data (will be encrypted)
 * @param {object} options - Job options (delay, priority, etc.)
 * @returns {Promise<Job>}
 */
export const addNotificationJob = async (type, data, options = {}) => {
  try {
    // Encrypt sensitive data
    const encryptedData = encryptJobData(data);

    // Add job to queue
    const job = await notificationQueue.add(
      type,
      {
        encrypted: true,
        ...encryptedData,
      },
      {
        ...options,
        jobId: options.jobId || `${type}-${data.notificationId || Date.now()}`,
      }
    );

    console.log(`📨 Added job ${job.id} to notification queue`);
    return job;
  } catch (error) {
    console.error('❌ Failed to add notification job:', error);
    throw error;
  }
};

/**
 * Cancel a scheduled notification job
 * @param {string} jobId - Job ID to cancel
 * @returns {Promise<boolean>}
 */
export const cancelNotificationJob = async (jobId) => {
  try {
    const job = await notificationQueue.getJob(jobId);
    if (!job) {
      console.warn(`⚠️  Job ${jobId} not found in queue`);
      return false;
    }

    const state = await job.getState();
    if (state === 'completed' || state === 'failed') {
      console.warn(`⚠️  Job ${jobId} already ${state}`);
      return false;
    }

    await job.remove();
    console.log(`🗑️  Cancelled job ${jobId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to cancel job ${jobId}:`, error);
    throw error;
  }
};

/**
 * Get queue statistics
 */
export const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      notificationQueue.getWaitingCount(),
      notificationQueue.getActiveCount(),
      notificationQueue.getCompletedCount(),
      notificationQueue.getFailedCount(),
      notificationQueue.getDelayedCount(),
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
    console.error('❌ Failed to get queue stats:', error);
    return null;
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏹️  Closing notification queue...');
  await notificationQueue.close();
  await connection.quit();
});

export default notificationQueue;

