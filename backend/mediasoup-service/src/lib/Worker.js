import * as mediasoup from 'mediasoup';
import { config } from '../config/mediasoup.js';

export class Worker {
  constructor() {
    this.worker = null;
    this.routers = new Map();
    this.nextRouterIndex = 0;
  }

  async init() {
    console.log('🔧 [Worker] Creating mediasoup worker...');

    try {
      this.worker = await mediasoup.createWorker({
        logLevel: config.worker.logLevel,
        logTags: config.worker.logTags,
        rtcMinPort: config.worker.rtcMinPort,
        rtcMaxPort: config.worker.rtcMaxPort,
      });

      this.worker.on('died', () => {
        console.error('❌ [Worker] Mediasoup worker died, exiting process');
        process.exit(1);
      });

      // Create initial router
      await this.createRouter();

      console.log('✅ [Worker] Mediasoup worker created successfully');
      console.log(`📊 [Worker] PID: ${this.worker.pid}`);
      console.log(`📊 [Worker] Resource usage:`, this.worker.resourceUsage);

      return this.worker;
    } catch (error) {
      console.error('❌ [Worker] Failed to create mediasoup worker:', error);
      throw error;
    }
  }

  async createRouter() {
    try {
      const router = await this.worker.createRouter({
        mediaCodecs: config.router.mediaCodecs,
      });

      const routerId = `router_${this.nextRouterIndex++}`;
      this.routers.set(routerId, router);

      console.log(`📡 [Worker] Router created: ${routerId}`);

      router.on('workerclose', () => {
        console.log(`📡 [Worker] Router ${routerId} closed`);
        this.routers.delete(routerId);
      });

      return { router, routerId };
    } catch (error) {
      console.error('❌ [Worker] Failed to create router:', error);
      throw error;
    }
  }

  getRouter(routerId) {
    return this.routers.get(routerId);
  }

  getAllRouters() {
    return Array.from(this.routers.values());
  }

  getRouterIds() {
    return Array.from(this.routers.keys());
  }

  getWorkerResourceUsage() {
    return this.worker ? this.worker.resourceUsage : null;
  }

  async close() {
    if (this.worker) {
      console.log('🔧 [Worker] Closing mediasoup worker...');
      this.worker.close();
      this.routers.clear();
    }
  }
}
