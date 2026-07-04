import { BaseQueue } from './base-queue.js';
import { BaseWorker } from './base-worker.js';

/**
 * Queue Manager
 * Centralized management for all queues and workers
 * Provides factory methods and health checks
 */
export class QueueManager {
  private queues: Map<string, BaseQueue>;
  private workers: Map<string, BaseWorker>;

  constructor() {
    this.queues = new Map<string, BaseQueue>();
    this.workers = new Map<string, BaseWorker>();
  }

  /**
   * Register a queue
   * @param name - Queue name
   * @param queue - Queue instance
   */
  registerQueue(name: string, queue: BaseQueue): void {
    if (this.queues.has(name)) {
      console.warn(`⚠️  Queue ${name} already registered, overwriting...`);
    }
    this.queues.set(name, queue);
    console.log(`✅ Registered queue: ${name}`);
  }

  /**
   * Register a worker
   * @param name - Worker name
   * @param worker - Worker instance
   */
  registerWorker(name: string, worker: BaseWorker): void {
    if (this.workers.has(name)) {
      console.warn(`⚠️  Worker ${name} already registered, overwriting...`);
    }
    this.workers.set(name, worker);
    console.log(`✅ Registered worker: ${name}`);
  }

  /**
   * Get a queue by name
   */
  getQueue(name: string): BaseQueue | null {
    return this.queues.get(name) || null;
  }

  /**
   * Get a worker by name
   */
  getWorker(name: string): BaseWorker | null {
    return this.workers.get(name) || null;
  }

  /**
   * Get all registered queues
   */
  getAllQueues(): Map<string, BaseQueue> {
    return this.queues;
  }

  /**
   * Get all registered workers
   */
  getAllWorkers(): Map<string, BaseWorker> {
    return this.workers;
  }

  /**
   * Health check for all queues
   */
  async healthCheck(): Promise<Record<string, any>> {
    const health: Record<string, any> = {
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
      } catch (error: any) {
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
      } catch (error: any) {
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
   */
  async getMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {
      queues: {},
      workers: {},
      timestamp: new Date().toISOString(),
    };

    // Get queue metrics
    for (const [name, queue] of this.queues.entries()) {
      try {
        metrics.queues[name] = await queue.getStats();
      } catch (error: any) {
        metrics.queues[name] = { error: error.message };
      }
    }

    // Get worker metrics
    for (const [name, worker] of this.workers.entries()) {
      try {
        metrics.workers[name] = await worker.getStats();
      } catch (error: any) {
        metrics.workers[name] = { error: error.message };
      }
    }

    return metrics;
  }

  /**
   * Close all queues and workers
   */
  async closeAll(): Promise<void> {
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
export default queueManager;
