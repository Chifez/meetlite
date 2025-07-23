import { EventEmitter } from 'events';

export class ConsumerHandler extends EventEmitter {
  constructor(room, participant) {
    super();
    this.room = room;
    this.participant = participant;
    this.consumers = new Map(); // consumerId -> { consumer, producerId, participantId, kind }
    this.consumerStates = new Map(); // consumerId -> state info
  }

  // Create consumer for a producer
  async createConsumer(producer, producerParticipantId) {
    try {
      // Check if participant can consume this producer
      if (
        !this.room.router.canConsume({
          producerId: producer.id,
          rtpCapabilities: this.participant.rtpCapabilities,
        })
      ) {
        console.warn(
          `⚠️ [Consumer] Participant ${this.participant.id} cannot consume producer ${producer.id}`
        );
        return null;
      }

      // Check if consumer already exists for this producer
      const existingConsumer = this.findConsumerByProducer(producer.id);
      if (existingConsumer) {
        console.warn(
          `⚠️ [Consumer] Consumer already exists for producer ${producer.id}`
        );
        return existingConsumer;
      }

      const transport = this.participant.getConsumeTransport();
      if (!transport) {
        throw new Error('No receive transport available');
      }

      const consumer = await transport.consume({
        producerId: producer.id,
        rtpCapabilities: this.participant.rtpCapabilities,
        paused: true, // Always start paused for proper synchronization
      });

      // Determine kind based on producer
      let kind = producer.kind;
      if (producer.appData?.screen) {
        kind = producer.kind === 'video' ? 'screen-video' : 'screen-audio';
      }

      // Store consumer info
      const consumerInfo = {
        consumer,
        producerId: producer.id,
        participantId: producerParticipantId,
        kind,
        originalKind: producer.kind,
      };

      this.consumers.set(consumer.id, consumerInfo);
      this.participant.addConsumer(consumer, producer.id);

      // Initialize consumer state
      this.consumerStates.set(consumer.id, {
        paused: true,
        closed: false,
        ready: false,
        lastResumeAttempt: null,
      });

      // Set up consumer event handlers
      this.setupConsumerEvents(consumer, consumerInfo);

      console.log(
        `🎬 [Consumer] Created ${kind} consumer ${consumer.id} for participant ${this.participant.id} (producer: ${producer.id})`
      );

      // Send consumer info to client
      this.participant.socket.emit('new-consumer', {
        participantId: producerParticipantId,
        producerId: producer.id,
        consumerId: consumer.id,
        kind,
        rtpParameters: consumer.rtpParameters,
        producerPaused: producer.paused,
        consumerPaused: consumer.paused,
      });

      this.emit('consumer-created', consumerInfo);
      return consumer;
    } catch (error) {
      console.error(
        `❌ [Consumer] Failed to create consumer for producer ${producer.id}:`,
        error
      );
      throw error;
    }
  }

  // Set up consumer event handlers
  setupConsumerEvents(consumer, consumerInfo) {
    consumer.on('close', () => {
      console.log(
        `🎬 [Consumer] Consumer ${consumer.id} closed for participant ${this.participant.id}`
      );
      this.handleConsumerClose(consumer.id);
    });

    consumer.on('pause', () => {
      console.log(
        `⏸️ [Consumer] Consumer ${consumer.id} paused for participant ${this.participant.id}`
      );
      this.updateConsumerState(consumer.id, { paused: true });
    });

    consumer.on('resume', () => {
      console.log(
        `▶️ [Consumer] Consumer ${consumer.id} resumed for participant ${this.participant.id}`
      );
      this.updateConsumerState(consumer.id, { paused: false, ready: true });
    });

    consumer.on('producerclose', () => {
      console.log(
        `📹 [Consumer] Producer closed for consumer ${consumer.id}, participant ${this.participant.id}`
      );
      this.handleProducerClose(consumer.id);
    });

    consumer.on('producerpause', () => {
      console.log(
        `⏸️ [Consumer] Producer paused for consumer ${consumer.id}, participant ${this.participant.id}`
      );
      this.participant.socket.emit('consumer-producer-paused', {
        consumerId: consumer.id,
        participantId: consumerInfo.participantId,
      });
    });

    consumer.on('producerresume', () => {
      console.log(
        `▶️ [Consumer] Producer resumed for consumer ${consumer.id}, participant ${this.participant.id}`
      );
      this.participant.socket.emit('consumer-producer-resumed', {
        consumerId: consumer.id,
        participantId: consumerInfo.participantId,
      });
    });

    consumer.on('layerschange', (layers) => {
      console.log(
        `🔄 [Consumer] Layers changed for consumer ${consumer.id}:`,
        layers
      );
    });
  }

  // Resume consumer (critical for fixing blank video issue)
  async resumeConsumer(consumerId) {
    try {
      const consumerInfo = this.consumers.get(consumerId);
      if (!consumerInfo) {
        throw new Error(`Consumer ${consumerId} not found`);
      }

      const { consumer } = consumerInfo;
      const state = this.consumerStates.get(consumerId);

      if (!consumer.paused) {
        console.log(`⚠️ [Consumer] Consumer ${consumerId} is already resumed`);
        return;
      }

      // Update last resume attempt
      this.updateConsumerState(consumerId, { lastResumeAttempt: Date.now() });

      await consumer.resume();

      console.log(
        `▶️ [Consumer] Successfully resumed consumer ${consumerId} for participant ${this.participant.id}`
      );

      // Notify client that consumer is ready
      this.participant.socket.emit('consumer-resumed', {
        consumerId,
        participantId: consumerInfo.participantId,
        kind: consumerInfo.kind,
      });
    } catch (error) {
      console.error(
        `❌ [Consumer] Failed to resume consumer ${consumerId}:`,
        error
      );

      // Notify client of error
      this.participant.socket.emit('consumer-error', {
        consumerId,
        error: 'Failed to resume consumer',
      });

      throw error;
    }
  }

  // Pause consumer
  async pauseConsumer(consumerId) {
    try {
      const consumerInfo = this.consumers.get(consumerId);
      if (!consumerInfo) {
        throw new Error(`Consumer ${consumerId} not found`);
      }

      const { consumer } = consumerInfo;

      if (consumer.paused) {
        console.log(`⚠️ [Consumer] Consumer ${consumerId} is already paused`);
        return;
      }

      await consumer.pause();
      console.log(
        `⏸️ [Consumer] Successfully paused consumer ${consumerId} for participant ${this.participant.id}`
      );
    } catch (error) {
      console.error(
        `❌ [Consumer] Failed to pause consumer ${consumerId}:`,
        error
      );
      throw error;
    }
  }

  // Handle consumer close
  handleConsumerClose(consumerId) {
    const consumerInfo = this.consumers.get(consumerId);
    if (consumerInfo) {
      this.updateConsumerState(consumerId, { closed: true });
      this.consumers.delete(consumerId);
      this.consumerStates.delete(consumerId);

      // Notify client
      this.participant.socket.emit('consumer-closed', {
        consumerId,
        participantId: consumerInfo.participantId,
      });

      this.emit('consumer-closed', consumerInfo);
    }
  }

  // Handle producer close
  handleProducerClose(consumerId) {
    const consumerInfo = this.consumers.get(consumerId);
    if (consumerInfo) {
      // Close the consumer
      consumerInfo.consumer.close();

      // Notify client
      this.participant.socket.emit('consumer-producer-closed', {
        consumerId,
        participantId: consumerInfo.participantId,
        producerId: consumerInfo.producerId,
      });
    }
  }

  // Update consumer state
  updateConsumerState(consumerId, updates) {
    const currentState = this.consumerStates.get(consumerId) || {};
    this.consumerStates.set(consumerId, { ...currentState, ...updates });
  }

  // Find consumer by producer ID
  findConsumerByProducer(producerId) {
    for (const consumerInfo of this.consumers.values()) {
      if (consumerInfo.producerId === producerId) {
        return consumerInfo.consumer;
      }
    }
    return null;
  }

  // Get consumer info by ID
  getConsumerInfo(consumerId) {
    return this.consumers.get(consumerId);
  }

  // Get all consumers for a participant
  getConsumersForParticipant(participantId) {
    const consumers = [];
    for (const consumerInfo of this.consumers.values()) {
      if (consumerInfo.participantId === participantId) {
        consumers.push(consumerInfo);
      }
    }
    return consumers;
  }

  // Get all active consumers
  getAllConsumers() {
    return Array.from(this.consumers.values());
  }

  // Resume all consumers (useful for connection recovery)
  async resumeAllConsumers() {
    console.log(
      `🔄 [Consumer] Resuming all consumers for participant ${this.participant.id}`
    );

    const resumePromises = [];
    for (const [consumerId, consumerInfo] of this.consumers) {
      if (consumerInfo.consumer.paused) {
        resumePromises.push(
          this.resumeConsumer(consumerId).catch((error) => {
            console.error(
              `❌ [Consumer] Failed to resume consumer ${consumerId}:`,
              error
            );
          })
        );
      }
    }

    await Promise.all(resumePromises);
  }

  // Close consumer by producer
  closeConsumerByProducer(producerId) {
    for (const [consumerId, consumerInfo] of this.consumers) {
      if (consumerInfo.producerId === producerId) {
        consumerInfo.consumer.close();
        break;
      }
    }
  }

  // Close all consumers
  closeAll() {
    console.log(
      `🔴 [Consumer] Closing all consumers for participant ${this.participant.id}`
    );

    for (const consumerInfo of this.consumers.values()) {
      consumerInfo.consumer.close();
    }

    this.consumers.clear();
    this.consumerStates.clear();
  }

  // Get consumer stats
  getStats() {
    return {
      totalConsumers: this.consumers.size,
      activeConsumers: Array.from(this.consumers.values()).filter(
        (info) =>
          !info.consumer.paused &&
          !this.consumerStates.get(info.consumer.id)?.closed
      ).length,
      pausedConsumers: Array.from(this.consumers.values()).filter(
        (info) => info.consumer.paused
      ).length,
    };
  }
}
