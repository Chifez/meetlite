/**
 * Queue Manager
 * Centralized management for all queues and workers
 * Provides factory methods and health checks
 */
export class QueueManager {
  constructor() {
    this.queues = new Map();
    this.workers = new Map();
  }

  /**
   * Register a queue
   * @param {string} name - Queue name
   * @param {BaseQueue} queue - Queue instance
   */
  registerQueue(name, queue) {
    if (this.queues.has(name)) {
      console.warn(`⚠️  Queue ${name} already registered, overwriting...`);
    }
    this.queues.set(name, queue);
    console.log(`✅ Registered queue: ${name}`);
  }

  /**
   * Register a worker
   * @param {string} name - Worker name
   * @param {BaseWorker} worker - Worker instance
   */
  registerWorker(name, worker) {
    if (this.workers.has(name)) {
      console.warn(`⚠️  Worker ${name} already registered, overwriting...`);
    }
    this.workers.set(name, worker);
    console.log(`✅ Registered worker: ${name}`);
  }

  /**
   * Get a queue by name
   * @param {string} name - Queue name
   * @returns {BaseQueue|null}
   */
  getQueue(name) {
    return this.queues.get(name) || null;
  }

  /**
   * Get a worker by name
   * @param {string} name - Worker name
   * @returns {BaseWorker|null}
   */
  getWorker(name) {
    return this.workers.get(name) || null;
  }

  /**
   * Get all registered queues
   * @returns {Map<string, BaseQueue>}
   */
  getAllQueues() {
    return this.queues;
  }

  /**
   * Get all registered workers
   * @returns {Map<string, BaseWorker>}
   */
  getAllWorkers() {
    return this.workers;
  }

  /**
   * Health check for all queues
   * @returns {Promise<object>}
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      queues: {},
      workers: {},
      timestamp: new Date().toISOString(),
    };

    // Check queues
    for (const [name, queue] of this.queues.entries()) {
      try {
        const stats = await queue.getStats();
        health.queues[name] = {
          status: 'healthy',
          stats,
        };
      } catch (error) {
        health.queues[name] = {
          status: 'unhealthy',
          error: error.message,
        };
        health.status = 'degraded';
      }
    }

    // Check workers
    for (const [name, worker] of this.workers.entries()) {
      try {
        const stats = await worker.getStats();
        health.workers[name] = {
          status: 'healthy',
          stats,
        };
      } catch (error) {
        health.workers[name] = {
          status: 'unhealthy',
          error: error.message,
        };
        health.status = 'degraded';
      }
    }

    return health;
  }

  /**
   * Get metrics for all queues and workers
   * @returns {Promise<object>}
   */
  async getMetrics() {
    const metrics = {
      queues: {},
      workers: {},
      timestamp: new Date().toISOString(),
    };

    // Get queue metrics
    for (const [name, queue] of this.queues.entries()) {
      try {
        metrics.queues[name] = await queue.getStats();
      } catch (error) {
        metrics.queues[name] = { error: error.message };
      }
    }

    // Get worker metrics
    for (const [name, worker] of this.workers.entries()) {
      try {
        metrics.workers[name] = await worker.getStats();
      } catch (error) {
        metrics.workers[name] = { error: error.message };
      }
    }

    return metrics;
  }

  /**
   * Close all queues and workers
   * @returns {Promise<void>}
   */
  async closeAll() {
    console.log('⏹️  Closing all queues and workers...');

    // Close all workers first
    const workerPromises = Array.from(this.workers.values()).map((worker) =>
      worker.close().catch((error) => {
        console.error(`❌ Error closing worker:`, error);
      })
    );

    // Close all queues
    const queuePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close().catch((error) => {
        console.error(`❌ Error closing queue:`, error);
      })
    );

    await Promise.all([...workerPromises, ...queuePromises]);
    console.log('✅ All queues and workers closed');
  }
}

// Singleton instance
export const queueManager = new QueueManager();

