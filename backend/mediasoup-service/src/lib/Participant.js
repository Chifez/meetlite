import { EventEmitter } from 'events';
import { ProducerHandler } from '../handlers/ProducerHandler.js';
import { ConsumerHandler } from '../handlers/ConsumerHandler.js';

export class Participant extends EventEmitter {
  constructor(id, transport, socket, userInfo, room) {
    super();
    this.id = id;
    this.transport = transport; // Keep for backward compatibility
    this.sendTransport = null; // For producing media
    this.recvTransport = null; // For consuming media
    this.socket = socket;
    this.userInfo = userInfo;
    this.room = room;
    this.rtpCapabilities = null;
    this.closed = false;

    // Initialize handlers
    this.producerHandler = new ProducerHandler(room, this);
    this.consumerHandler = new ConsumerHandler(room, this);

    // Set up handler event forwarding
    this.setupHandlerEvents();

    console.log(`👤 [Participant] Created participant: ${id}`);
  }

  // Set up event forwarding from handlers
  setupHandlerEvents() {
    // Producer events
    this.producerHandler.on('producer-created', (data) => {
      this.emit('producer-created', data.producer);
    });

    this.producerHandler.on('producer-closed', (data) => {
      this.emit('producer-closed', data.producerId);
    });

    this.producerHandler.on('notify-consumers', (data) => {
      // Forward to room for handling
      this.emit('notify-consumers', data);
    });

    // Consumer events
    this.consumerHandler.on('consumer-created', (consumerInfo) => {
      this.emit('consumer-created', consumerInfo);
    });

    this.consumerHandler.on('consumer-closed', (consumerInfo) => {
      this.emit('consumer-closed', consumerInfo);
    });
  }

  // Set RTP capabilities
  setRtpCapabilities(rtpCapabilities) {
    this.rtpCapabilities = rtpCapabilities;
    console.log(`📡 [Participant] RTP capabilities set for ${this.id}`);
  }

  // Get the appropriate transport for the operation
  getProduceTransport() {
    return this.sendTransport || this.transport;
  }

  getConsumeTransport() {
    return this.recvTransport || this.transport;
  }

  // Create producers using handler (use send transport)
  async createAudioProducer(rtpParameters, paused = false) {
    return await this.producerHandler.createAudioProducer(
      rtpParameters,
      paused
    );
  }

  async createVideoProducer(rtpParameters, paused = false) {
    return await this.producerHandler.createVideoProducer(
      rtpParameters,
      paused
    );
  }

  async createScreenVideoProducer(rtpParameters, paused = false) {
    return await this.producerHandler.createScreenVideoProducer(
      rtpParameters,
      paused
    );
  }

  async createScreenAudioProducer(rtpParameters, paused = false) {
    return await this.producerHandler.createScreenAudioProducer(
      rtpParameters,
      paused
    );
  }

  // Producer control methods
  async pauseProducer(kind) {
    return await this.producerHandler.pauseProducer(kind);
  }

  async resumeProducer(kind) {
    return await this.producerHandler.resumeProducer(kind);
  }

  async closeProducer(kind) {
    return await this.producerHandler.closeProducer(kind);
  }

  // Consumer management using handler (use receive transport)
  async createConsumer(producer, producerParticipantId) {
    return await this.consumerHandler.createConsumer(
      producer,
      producerParticipantId
    );
  }

  async resumeConsumer(consumerId) {
    return await this.consumerHandler.resumeConsumer(consumerId);
  }

  async pauseConsumer(consumerId) {
    return await this.consumerHandler.pauseConsumer(consumerId);
  }

  // Legacy methods for backward compatibility
  addProducer(producer) {
    // This is handled by the ProducerHandler now
    console.log(
      `📹 [Participant] Producer ${producer.id} added via handler for ${this.id}`
    );
  }

  addConsumer(consumer, producerId) {
    // This is handled by the ConsumerHandler now
    console.log(
      `🎬 [Participant] Consumer ${consumer.id} added via handler for ${this.id}`
    );
  }

  removeProducer(producerId) {
    console.log(
      `📹 [Participant] Producer ${producerId} removed for ${this.id}`
    );
  }

  removeConsumer(consumerId) {
    console.log(
      `🎬 [Participant] Consumer ${consumerId} removed for ${this.id}`
    );
  }

  // Get producer by ID - delegate to handler
  getProducer(producerId) {
    const producers = this.producerHandler.getActiveProducers();
    for (const producer of Object.values(producers)) {
      if (producer.id === producerId) {
        return producer;
      }
    }
    return null;
  }

  // Get all producers - delegate to handler
  getProducers() {
    return Object.values(this.producerHandler.getActiveProducers());
  }

  // Get consumer by ID - delegate to handler
  getConsumer(consumerId) {
    return this.consumerHandler.getConsumerInfo(consumerId)?.consumer || null;
  }

  // Get all consumers - delegate to handler
  getConsumers() {
    return this.consumerHandler.getAllConsumers().map((info) => info.consumer);
  }

  // Additional handler methods
  getProducerByKind(kind) {
    return this.producerHandler.getProducerByKind(kind);
  }

  getConsumerInfo(consumerId) {
    return this.consumerHandler.getConsumerInfo(consumerId);
  }

  getConsumersForParticipant(participantId) {
    return this.consumerHandler.getConsumersForParticipant(participantId);
  }

  async resumeAllConsumers() {
    return await this.consumerHandler.resumeAllConsumers();
  }

  closeConsumerByProducer(producerId) {
    return this.consumerHandler.closeConsumerByProducer(producerId);
  }

  // Get participant stats
  getStats() {
    return {
      id: this.id,
      userInfo: this.userInfo,
      rtpCapabilities: !!this.rtpCapabilities,
      producers: this.producerHandler.getActiveProducers(),
      consumers: this.consumerHandler.getStats(),
      transports: {
        send: !!this.sendTransport,
        recv: !!this.recvTransport,
        legacy: !!this.transport,
      },
    };
  }

  // Close participant
  close() {
    if (this.closed) {
      return;
    }

    console.log(`👤 [Participant] Closing participant: ${this.id}`);
    this.closed = true;

    // Close handlers (this will close all producers and consumers)
    this.producerHandler.closeAll();
    this.consumerHandler.closeAll();

    // Close transports
    if (this.sendTransport) {
      this.sendTransport.close();
    }
    if (this.recvTransport) {
      this.recvTransport.close();
    }
    if (this.transport) {
      this.transport.close();
    }

    this.emit('close');
  }
}
