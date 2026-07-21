// @ts-ignore
import * as mediasoup from 'mediasoup';
import { mediasoupConfig } from '../config/mediasoup.js';
import { logger } from '../utils/logger.js';

/**
 * MediaSoup Worker Service
 * Manages MediaSoup workers, routers, transports, producers, and consumers
 */
export class MediaSoupWorker {
  private workers: Map<number, any>;
  private routers: Map<string, any>;
  private transports: Map<string, any>;
  private producers: Map<string, any>;
  private consumers: Map<string, any>;
  private nextWorkerIndex: number;
  private workerPoolSize: number;

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
  async createWorker(index: number) {
    try {
      const worker = await mediasoup.createWorker({
        ...mediasoupConfig.worker,
        appData: {
          workerIndex: index,
          createdAt: Date.now(),
        },
      });

      worker.on('died', () => {
        logger.error('MediaSoup worker died', {
          pid: worker.pid,
          workerIndex: index,
        });

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
    } catch (error: any) {
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
  async createRouter(roomId: string) {
    try {
      const worker = this.getNextWorker();

      const router = await worker.createRouter({
        mediaCodecs: mediasoupConfig.router.mediaCodecs,
      });

      const activeSpeakerObserver = await router.createActiveSpeakerObserver();
      const audioLevelObserver = await router.createAudioLevelObserver({
        maxEntries: 1,
        threshold: -80,
        interval: 300,
      });

      this.routers.set(roomId, {
        router,
        activeSpeakerObserver,
        audioLevelObserver,
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
  getRouter(roomId: string) {
    const routerData = this.routers.get(roomId);
    return routerData ? routerData.router : null;
  }

  /**
   * Get router data for a room
   */
  getRouterData(roomId: string) {
    return this.routers.get(roomId) || null;
  }

  /**
   * Create WebRTC transport
   */
  async createWebRtcTransport(roomId: string, direction: string) {
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
  async connectTransport(transportId: string, dtlsParameters: any) {
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
   * Get producer data by ID
   */
  getProducerData(producerId: string) {
    return this.producers.get(producerId) || null;
  }

  /**
   * Close and remove a transport by ID
   */
  closeTransport(transportId: string) {
    const transportData = this.transports.get(transportId);
    if (!transportData) {
      logger.warn('Transport not found for close', { transportId });
      return;
    }

    try {
      transportData.transport.close();
      this.transports.delete(transportId);
      logger.info('Transport closed', { transportId, roomId: transportData.roomId });
    } catch (error) {
      logger.error('Failed to close transport', { transportId, error });
      this.transports.delete(transportId);
    }
  }

  /**
   * Create producer
   */
  async createProducer(transportId: string, rtpParameters: any, kind: string, userId: string, appData: any = {}) {
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
          source: appData.source || 'camera',
          mediaType: appData.mediaType || `camera-${kind}`,
          ...appData,
        },
      });

      this.producers.set(producer.id, {
        producer,
        roomId: transportData.roomId,
        userId,
        kind,
        source: appData.source || 'camera',
        mediaType: appData.mediaType || `camera-${kind}`,
        createdAt: Date.now(),
      });

      const routerData = this.routers.get(transportData.roomId);
      if (routerData) {
        routerData.participantCount++;

        if (kind === 'audio') {
          if (routerData.activeSpeakerObserver) {
            await routerData.activeSpeakerObserver.addProducer({ producerId: producer.id });
          }
          if (routerData.audioLevelObserver) {
            await routerData.audioLevelObserver.addProducer({ producerId: producer.id });
          }
        }
      }

      logger.info('Producer created', {
        producerId: producer.id,
        roomId: transportData.roomId,
        userId,
        kind,
        source: appData.source || 'camera',
        mediaType: appData.mediaType || `camera-${kind}`,
      });

      return {
        id: producer.id,
        source: appData.source || 'camera',
        mediaType: appData.mediaType || `camera-${kind}`,
      };
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
  async createConsumer(transportId: string, producerId: string, rtpCapabilities: any, userId: string) {
    try {
      const transportData = this.transports.get(transportId);
      if (!transportData) {
        throw new Error(`Transport not found: ${transportId}`);
      }

      const producerData = this.producers.get(producerId);
      if (!producerData) {
        throw new Error(`Producer not found: ${producerId}`);
      }

      const routerData = this.routers.get(transportData.roomId);
      if (!routerData) {
        throw new Error(`Router not found for room: ${transportData.roomId}`);
      }

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
  async pauseProducer(producerId: string) {
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
  async resumeProducer(producerId: string) {
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
   * Close producer
   */
  async closeProducer(producerId: string) {
    try {
      const producerData = this.producers.get(producerId);
      if (!producerData) {
        throw new Error(`Producer not found: ${producerId}`);
      }

      await producerData.producer.close();
      this.producers.delete(producerId);

      logger.info('Producer closed', { producerId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to close producer', { producerId, error });
      throw error;
    }
  }

  /**
   * Get router RTP capabilities
   */
  async getRtpCapabilities(roomId: string) {
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
  async cleanupRoom(roomId: string) {
    try {
      logger.info('Cleaning up room resources', { roomId });

      for (const [transportId, transportData] of this.transports.entries()) {
        if (transportData.roomId === roomId) {
          transportData.transport.close();
          this.transports.delete(transportId);
        }
      }

      for (const [producerId, producerData] of this.producers.entries()) {
        if (producerData.roomId === roomId) {
          producerData.producer.close();
          this.producers.delete(producerId);
        }
      }

      for (const [consumerId, consumerData] of this.consumers.entries()) {
        if (consumerData.roomId === roomId) {
          consumerData.consumer.close();
          this.consumers.delete(consumerId);
        }
      }

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
   * Set consumer preferred spatial layer for simulcast
   */
  async setConsumerLayers(consumerId: string, spatialLayer: number) {
    try {
      const consumerData = this.consumers.get(consumerId);
      if (!consumerData) {
        throw new Error(`Consumer not found: ${consumerId}`);
      }

      await consumerData.consumer.setPreferredLayers({ spatialLayer });
      logger.info('Consumer spatial layer set', { consumerId, spatialLayer });
      return { success: true };
    } catch (error) {
      logger.error('Failed to set consumer layers', { consumerId, spatialLayer, error });
      throw error;
    }
  }

  /**
   * Restart ICE for a transport
   */
  async restartIce(transportId: string) {
    try {
      const transportData = this.transports.get(transportId);
      if (!transportData) {
        throw new Error(`Transport not found: ${transportId}`);
      }

      const iceParameters = await transportData.transport.restartIce();
      logger.info('Transport ICE restarted', { transportId });
      return iceParameters;
    } catch (error) {
      logger.error('Failed to restart ICE', { transportId, error });
      throw error;
    }
  }

  /**
   * Get all producers for a room
   */
  getProducersForRoom(roomId: string) {
    const producers = [];
    for (const [producerId, producerData] of this.producers.entries()) {
      if (producerData.roomId === roomId) {
        producers.push({
          id: producerId,
          userId: producerData.userId,
          kind: producerData.kind,
          source: producerData.source,
          mediaType: producerData.mediaType,
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

    for (const [roomId, routerData] of this.routers.entries()) {
      try {
        routerData.router.close();
      } catch (error) {
        logger.error('Error closing router', { roomId, error });
      }
    }

    for (const [index, worker] of this.workers.entries()) {
      try {
        await worker.close();
        logger.info('Worker closed', { index, pid: worker.pid });
      } catch (error) {
        logger.error('Error closing worker', { index, error });
      }
    }

    this.workers.clear();
    this.routers.clear();
    this.transports.clear();
    this.producers.clear();
    this.consumers.clear();

    logger.info('All MediaSoup workers shut down');
  }
}
