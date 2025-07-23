import { EventEmitter } from 'events';
import { Worker } from './Worker.js';
import { Room } from './Room.js';
import { config } from '../config/mediasoup.js';

export class MediasoupServer extends EventEmitter {
  constructor() {
    super();
    this.workers = [];
    this.rooms = new Map();
    this.nextWorkerIndex = 0;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    console.log('🚀 [MediasoupServer] Initializing mediasoup server...');

    try {
      // Create workers
      for (let i = 0; i < config.numWorkers; i++) {
        const worker = new Worker();
        await worker.init();
        this.workers.push(worker);
      }

      this.initialized = true;
      console.log(
        `✅ [MediasoupServer] Server initialized with ${this.workers.length} workers`
      );

      // Log router information
      this.workers.forEach((worker, index) => {
        console.log(
          `📡 [MediasoupServer] Worker ${index} has ${
            worker.getRouterIds().length
          } routers`
        );
      });
    } catch (error) {
      console.error('❌ [MediasoupServer] Failed to initialize server:', error);
      throw error;
    }
  }

  // Get the next available worker using round-robin
  getNextWorker() {
    if (this.workers.length === 0) {
      throw new Error('No workers available');
    }

    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  // Create or get a room
  async getOrCreateRoom(roomId) {
    // Check if room already exists
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }

    try {
      // Get worker with least load or use round-robin
      const worker = this.getNextWorker();

      // Get an available router or create a new one
      let router;
      const availableRouters = worker.getAllRouters();

      if (availableRouters.length > 0) {
        // Use existing router (you might want to implement load balancing here)
        router = availableRouters[0];
      } else {
        // Create new router
        const result = await worker.createRouter();
        router = result.router;
      }

      // Create room
      const room = new Room(roomId, router);
      this.rooms.set(roomId, room);

      // Handle room closure
      room.on('close', () => {
        console.log(`🏠 [MediasoupServer] Room ${roomId} closed`);
        this.rooms.delete(roomId);
      });

      console.log(
        `🏠 [MediasoupServer] Created room: ${roomId} (Total rooms: ${this.rooms.size})`
      );
      return room;
    } catch (error) {
      console.error(
        `❌ [MediasoupServer] Failed to create room ${roomId}:`,
        error
      );
      throw error;
    }
  }

  // Get room by ID
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // Create WebRTC transport for a participant
  async createWebRtcTransport(roomId) {
    const room = await this.getOrCreateRoom(roomId);

    try {
      const transport = await room.router.createWebRtcTransport({
        listenIps: config.webRtcTransport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate:
          config.webRtcTransport.initialAvailableOutgoingBitrate,
        minimumAvailableOutgoingBitrate:
          config.webRtcTransport.minimumAvailableOutgoingBitrate,
        enableSctp: config.webRtcTransport.enableSctp,
        numSctpStreams: config.webRtcTransport.numSctpStreams,
        maxSctpMessageSize: config.webRtcTransport.maxSctpMessageSize,
      });

      // Handle transport events
      transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'failed' || dtlsState === 'closed') {
          console.warn(
            `🌐 [MediasoupServer] Transport DTLS state: ${dtlsState}`
          );
        }
      });

      transport.on('icestatechange', (iceState) => {
        if (iceState === 'disconnected' || iceState === 'closed') {
          console.warn(`🌐 [MediasoupServer] Transport ICE state: ${iceState}`);
        }
      });

      console.log(
        `🌐 [MediasoupServer] Created WebRTC transport: ${transport.id}`
      );

      return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        transport, // Return the actual transport object for internal use
      };
    } catch (error) {
      console.error(
        '❌ [MediasoupServer] Failed to create WebRTC transport:',
        error
      );
      throw error;
    }
  }

  // Get server stats
  getStats() {
    const roomStats = Array.from(this.rooms.values()).map((room) =>
      room.getStats()
    );

    return {
      workers: this.workers.length,
      rooms: this.rooms.size,
      totalParticipants: roomStats.reduce(
        (total, room) => total + room.participantCount,
        0
      ),
      totalProducers: roomStats.reduce(
        (total, room) => total + room.totalProducers,
        0
      ),
      totalConsumers: roomStats.reduce(
        (total, room) => total + room.totalConsumers,
        0
      ),
      roomStats,
      workerStats: this.workers.map((worker, index) => ({
        index,
        pid: worker.worker?.pid,
        resourceUsage: worker.getWorkerResourceUsage(),
        routers: worker.getRouterIds().length,
      })),
    };
  }

  // Get router RTP capabilities
  getRouterRtpCapabilities(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }
    return room.router.rtpCapabilities;
  }

  // Close server
  async close() {
    console.log('🔧 [MediasoupServer] Closing mediasoup server...');

    // Close all rooms
    for (const room of this.rooms.values()) {
      room.close();
    }
    this.rooms.clear();

    // Close all workers
    for (const worker of this.workers) {
      await worker.close();
    }
    this.workers.length = 0;

    this.initialized = false;
    console.log('✅ [MediasoupServer] Server closed');
  }
}
