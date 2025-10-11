import * as mediasoup from 'mediasoup';
import { mediasoupConfig } from '../config/mediasoup.js';
import { logger } from '../utils/logger.js';

/**
 * MediaSoup Worker Service
 * Manages MediaSoup workers, routers, transports, producers, and consumers
 */
export class MediaSoupWorker {
  constructor() {
    this.workers = new Map();
    this.routers = new Map();
    this.transports = new Map();
    this.producers = new Map();
    this.consumers = new Map();
    this.nextWorkerIndex = 0;
    this.workerPoolSize = mediasoupConfig.performance.workerPoolSize;

    logger.info('MediaSoupWorker initialized', {
      workerPoolSize: this.workerPoolSize,
      config: {
        rtcMinPort: mediasoupConfig.worker.rtcMinPort,
        rtcMaxPort: mediasoupConfig.worker.rtcMaxPort,
      },
    });
  }

  /**
   * Initialize MediaSoup workers
   */
  async initializeWorkers() {
    logger.info('Initializing MediaSoup workers...', {
      poolSize: this.workerPoolSize,
    });

    const workerPromises = [];

    for (let i = 0; i < this.workerPoolSize; i++) {
      workerPromises.push(this.createWorker(i));
    }

    try {
      await Promise.all(workerPromises);
      logger.info('All MediaSoup workers initialized successfully', {
        workerCount: this.workers.size,
      });
    } catch (error) {
      logger.error('Failed to initialize MediaSoup workers', error);
      throw error;
    }
  }

  /**
   * Create a new MediaSoup worker
   */
  async createWorker(index) {
    try {
      const worker = await mediasoup.createWorker({
        ...mediasoupConfig.worker,
        // Add worker-specific settings
        appData: {
          workerIndex: index,
          createdAt: Date.now(),
        },
      });

      // Handle worker events
      worker.on('died', () => {
        logger.error('MediaSoup worker died', {
          pid: worker.pid,
          workerIndex: index,
        });

        // Remove worker from pool and create replacement
        this.workers.delete(index);
        this.createWorker(index).catch((error) => {
          logger.error('Failed to recreate worker', { index, error });
        });
      });

      this.workers.set(index, worker);

      logger.info('MediaSoup worker created', {
        pid: worker.pid,
        workerIndex: index,
      });

      return worker;
    } catch (error) {
      logger.error('Failed to create MediaSoup worker', {
        index,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get the next available worker (round-robin)
   */
  getNextWorker() {
    if (this.workers.size === 0) {
      throw new Error('No MediaSoup workers available');
    }

    const workerIndex = this.nextWorkerIndex % this.workers.size;
    this.nextWorkerIndex++;

    return this.workers.get(workerIndex);
  }

  /**
   * Create a router for a room
   */
  async createRouter(roomId) {
    try {
      const worker = this.getNextWorker();

      const router = await worker.createRouter({
        mediaCodecs: mediasoupConfig.router.mediaCodecs,
      });

      this.routers.set(roomId, {
        router,
        worker,
        createdAt: Date.now(),
        participantCount: 0,
      });

      logger.info('Router created for room', {
        roomId,
        routerId: router.id,
        workerPid: worker.pid,
      });

      return router;
    } catch (error) {
      logger.error('Failed to create router', { roomId, error });
      throw error;
    }
  }

  /**
   * Get router for a room
   */
  getRouter(roomId) {
    const routerData = this.routers.get(roomId);
    return routerData ? routerData.router : null;
  }

  /**
   * Create WebRTC transport
   */
  async createWebRtcTransport(roomId, direction) {
    try {
      const routerData = this.routers.get(roomId);
      if (!routerData) {
        throw new Error(`Router not found for room: ${roomId}`);
      }

      const transport = await routerData.router.createWebRtcTransport({
        ...mediasoupConfig.webRtcTransport,
        appData: {
          roomId,
          direction,
          createdAt: Date.now(),
        },
      });

      // Use actual MediaSoup transport ID (critical for client-side compatibility)
      this.transports.set(transport.id, {
        transport,
        roomId,
        direction,
        createdAt: Date.now(),
      });

      logger.info('WebRTC transport created', {
        transportId: transport.id,
        roomId,
        direction,
        iceParameters: transport.iceParameters,
      });

      return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      };
    } catch (error) {
      logger.error('Failed to create WebRTC transport', {
        roomId,
        direction,
        error,
      });
      throw error;
    }
  }

  /**
   * Connect transport
   */
  async connectTransport(transportId, dtlsParameters) {
    try {
      const transportData = this.transports.get(transportId);
      if (!transportData) {
        throw new Error(`Transport not found: ${transportId}`);
      }

      await transportData.transport.connect({ dtlsParameters });

      logger.info('Transport connected', {
        transportId,
        roomId: transportData.roomId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to connect transport', {
        transportId,
        error,
      });
      throw error;
    }
  }

  /**
   * Create producer
   */
  async createProducer(transportId, rtpParameters, kind, userId) {
    try {
      const transportData = this.transports.get(transportId);
      if (!transportData) {
        throw new Error(`Transport not found: ${transportId}`);
      }

      const producer = await transportData.transport.produce({
        kind,
        rtpParameters,
        appData: {
          userId,
          roomId: transportData.roomId,
          createdAt: Date.now(),
        },
      });

      // Use actual MediaSoup producer ID (critical for client-side compatibility)
      this.producers.set(producer.id, {
        producer,
        roomId: transportData.roomId,
        userId,
        kind,
        createdAt: Date.now(),
      });

      // Update room participant count
      const routerData = this.routers.get(transportData.roomId);
      if (routerData) {
        routerData.participantCount++;
      }

      logger.info('Producer created', {
        producerId: producer.id,
        roomId: transportData.roomId,
        userId,
        kind,
      });

      return { id: producer.id };
    } catch (error) {
      logger.error('Failed to create producer', {
        transportId,
        userId,
        kind,
        error,
      });
      throw error;
    }
  }

  /**
   * Create consumer
   */
  async createConsumer(transportId, producerId, rtpCapabilities, userId) {
    try {
      const transportData = this.transports.get(transportId);
      if (!transportData) {
        throw new Error(`Transport not found: ${transportId}`);
      }

      const producerData = this.producers.get(producerId);
      if (!producerData) {
        throw new Error(`Producer not found: ${producerId}`);
      }

      // Get the router for this room
      const routerData = this.routers.get(transportData.roomId);
      if (!routerData) {
        throw new Error(`Router not found for room: ${transportData.roomId}`);
      }

      // Check if router can consume this producer
      if (
        !routerData.router.canConsume({
          producerId: producerData.producer.id,
          rtpCapabilities,
        })
      ) {
        throw new Error('Router cannot consume this producer');
      }

      const consumer = await transportData.transport.consume({
        producerId: producerData.producer.id,
        rtpCapabilities,
        paused: false,
        appData: {
          userId,
          roomId: transportData.roomId,
          producerId,
          createdAt: Date.now(),
        },
      });

      // Use actual MediaSoup consumer ID (critical for client-side compatibility)
      this.consumers.set(consumer.id, {
        consumer,
        roomId: transportData.roomId,
        userId,
        producerId,
        createdAt: Date.now(),
      });

      logger.info('Consumer created', {
        consumerId: consumer.id,
        roomId: transportData.roomId,
        userId,
        producerId,
      });

      return {
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      };
    } catch (error) {
      logger.error('Failed to create consumer', {
        transportId,
        producerId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Pause producer
   */
  async pauseProducer(producerId) {
    try {
      const producerData = this.producers.get(producerId);
      if (!producerData) {
        throw new Error(`Producer not found: ${producerId}`);
      }

      await producerData.producer.pause();

      logger.info('Producer paused', { producerId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to pause producer', { producerId, error });
      throw error;
    }
  }

  /**
   * Resume producer
   */
  async resumeProducer(producerId) {
    try {
      const producerData = this.producers.get(producerId);
      if (!producerData) {
        throw new Error(`Producer not found: ${producerId}`);
      }

      await producerData.producer.resume();

      logger.info('Producer resumed', { producerId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to resume producer', { producerId, error });
      throw error;
    }
  }

  /**
   * Get router RTP capabilities
   */
  async getRtpCapabilities(roomId) {
    try {
      const routerData = this.routers.get(roomId);
      if (!routerData) {
        throw new Error(`Router not found for room: ${roomId}`);
      }

      return routerData.router.rtpCapabilities;
    } catch (error) {
      logger.error('Failed to get RTP capabilities', { roomId, error });
      throw error;
    }
  }

  /**
   * Cleanup room resources
   */
  async cleanupRoom(roomId) {
    try {
      logger.info('Cleaning up room resources', { roomId });

      // Close all transports for this room
      for (const [transportId, transportData] of this.transports.entries()) {
        if (transportData.roomId === roomId) {
          transportData.transport.close();
          this.transports.delete(transportId);
        }
      }

      // Close all producers for this room
      for (const [producerId, producerData] of this.producers.entries()) {
        if (producerData.roomId === roomId) {
          producerData.producer.close();
          this.producers.delete(producerId);
        }
      }

      // Close all consumers for this room
      for (const [consumerId, consumerData] of this.consumers.entries()) {
        if (consumerData.roomId === roomId) {
          consumerData.consumer.close();
          this.consumers.delete(consumerId);
        }
      }

      // Close router
      const routerData = this.routers.get(roomId);
      if (routerData) {
        routerData.router.close();
        this.routers.delete(roomId);
      }

      logger.info('Room resources cleaned up', { roomId });
    } catch (error) {
      logger.error('Failed to cleanup room resources', { roomId, error });
      throw error;
    }
  }

  /**
   * Get all producers for a room
   */
  getProducersForRoom(roomId) {
    const producers = [];
    for (const [producerId, producerData] of this.producers.entries()) {
      if (producerData.roomId === roomId) {
        producers.push({
          id: producerId,
          userId: producerData.userId,
          kind: producerData.kind,
        });
      }
    }
    return producers;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      workers: this.workers.size,
      routers: this.routers.size,
      transports: this.transports.size,
      producers: this.producers.size,
      consumers: this.consumers.size,
      workerPoolSize: this.workerPoolSize,
    };
  }

  /**
   * Shutdown all workers
   */
  async shutdown() {
    logger.info('Shutting down MediaSoup workers...');

    // Close all routers first
    for (const [roomId, routerData] of this.routers.entries()) {
      try {
        routerData.router.close();
      } catch (error) {
        logger.error('Error closing router', { roomId, error });
      }
    }

    // Close all workers
    for (const [index, worker] of this.workers.entries()) {
      try {
        await worker.close();
        logger.info('Worker closed', { index, pid: worker.pid });
      } catch (error) {
        logger.error('Error closing worker', { index, error });
      }
    }

    // Clear all maps
    this.workers.clear();
    this.routers.clear();
    this.transports.clear();
    this.producers.clear();
    this.consumers.clear();

    logger.info('All MediaSoup workers shut down');
  }
}
