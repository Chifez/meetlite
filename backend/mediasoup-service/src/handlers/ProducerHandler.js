import { EventEmitter } from 'events';

export class ProducerHandler extends EventEmitter {
  constructor(room, participant) {
    super();
    this.room = room;
    this.participant = participant;
    this.audioProducer = null;
    this.videoProducer = null;
    this.screenVideoProducer = null;
    this.screenAudioProducer = null;
  }

  // Create audio producer
  async createAudioProducer(rtpParameters, paused = false) {
    try {
      if (this.audioProducer) {
        console.warn(
          `⚠️ [Producer] Audio producer already exists for ${this.participant.id}`
        );
        return this.audioProducer;
      }

      const transport = this.participant.getProduceTransport();
      if (!transport) {
        throw new Error('No send transport available');
      }

      const producer = await transport.produce({
        kind: 'audio',
        rtpParameters,
        paused,
      });

      this.audioProducer = producer;
      this.participant.addProducer(producer);

      // Handle producer events
      producer.on('close', () => {
        console.log(
          `🎵 [Producer] Audio producer closed for ${this.participant.id}`
        );
        this.audioProducer = null;
        this.emit('producer-closed', {
          kind: 'audio',
          producerId: producer.id,
        });
      });

      producer.on('pause', () => {
        console.log(
          `⏸️ [Producer] Audio producer paused for ${this.participant.id}`
        );
        this.notifyConsumers('audio', 'paused', true);
      });

      producer.on('resume', () => {
        console.log(
          `▶️ [Producer] Audio producer resumed for ${this.participant.id}`
        );
        this.notifyConsumers('audio', 'paused', false);
      });

      console.log(
        `🎵 [Producer] Audio producer created for ${this.participant.id}: ${producer.id}`
      );
      this.emit('producer-created', { kind: 'audio', producer });

      return producer;
    } catch (error) {
      console.error(
        `❌ [Producer] Failed to create audio producer for ${this.participant.id}:`,
        error
      );
      throw error;
    }
  }

  // Create video producer
  async createVideoProducer(rtpParameters, paused = false) {
    try {
      if (this.videoProducer) {
        console.warn(
          `⚠️ [Producer] Video producer already exists for ${this.participant.id}`
        );
        return this.videoProducer;
      }

      const transport = this.participant.getProduceTransport();
      if (!transport) {
        throw new Error('No send transport available');
      }

      const producer = await transport.produce({
        kind: 'video',
        rtpParameters,
        paused,
      });

      this.videoProducer = producer;
      this.participant.addProducer(producer);

      // Handle producer events
      producer.on('close', () => {
        console.log(
          `📹 [Producer] Video producer closed for ${this.participant.id}`
        );
        this.videoProducer = null;
        this.emit('producer-closed', {
          kind: 'video',
          producerId: producer.id,
        });
      });

      producer.on('pause', () => {
        console.log(
          `⏸️ [Producer] Video producer paused for ${this.participant.id}`
        );
        this.notifyConsumers('video', 'paused', true);
      });

      producer.on('resume', () => {
        console.log(
          `▶️ [Producer] Video producer resumed for ${this.participant.id}`
        );
        this.notifyConsumers('video', 'paused', false);
      });

      console.log(
        `📹 [Producer] Video producer created for ${this.participant.id}: ${producer.id}`
      );
      this.emit('producer-created', { kind: 'video', producer });

      return producer;
    } catch (error) {
      console.error(
        `❌ [Producer] Failed to create video producer for ${this.participant.id}:`,
        error
      );
      throw error;
    }
  }

  // Create screen share video producer
  async createScreenVideoProducer(rtpParameters, paused = false) {
    try {
      if (this.screenVideoProducer) {
        console.warn(
          `⚠️ [Producer] Screen video producer already exists for ${this.participant.id}`
        );
        return this.screenVideoProducer;
      }

      const producer = await this.participant.transport.produce({
        kind: 'video',
        rtpParameters,
        paused,
        appData: { screen: true }, // Mark as screen share
      });

      this.screenVideoProducer = producer;
      this.participant.addProducer(producer);

      // Handle producer events
      producer.on('close', () => {
        console.log(
          `💻 [Producer] Screen video producer closed for ${this.participant.id}`
        );
        this.screenVideoProducer = null;
        this.emit('producer-closed', {
          kind: 'screen-video',
          producerId: producer.id,
        });
      });

      producer.on('pause', () => {
        console.log(
          `⏸️ [Producer] Screen video producer paused for ${this.participant.id}`
        );
        this.notifyConsumers('screen-video', 'paused', true);
      });

      producer.on('resume', () => {
        console.log(
          `▶️ [Producer] Screen video producer resumed for ${this.participant.id}`
        );
        this.notifyConsumers('screen-video', 'paused', false);
      });

      console.log(
        `💻 [Producer] Screen video producer created for ${this.participant.id}: ${producer.id}`
      );
      this.emit('producer-created', { kind: 'screen-video', producer });

      return producer;
    } catch (error) {
      console.error(
        `❌ [Producer] Failed to create screen video producer for ${this.participant.id}:`,
        error
      );
      throw error;
    }
  }

  // Create screen share audio producer
  async createScreenAudioProducer(rtpParameters, paused = false) {
    try {
      if (this.screenAudioProducer) {
        console.warn(
          `⚠️ [Producer] Screen audio producer already exists for ${this.participant.id}`
        );
        return this.screenAudioProducer;
      }

      const producer = await this.participant.transport.produce({
        kind: 'audio',
        rtpParameters,
        paused,
        appData: { screen: true }, // Mark as screen share
      });

      this.screenAudioProducer = producer;
      this.participant.addProducer(producer);

      // Handle producer events
      producer.on('close', () => {
        console.log(
          `💻 [Producer] Screen audio producer closed for ${this.participant.id}`
        );
        this.screenAudioProducer = null;
        this.emit('producer-closed', {
          kind: 'screen-audio',
          producerId: producer.id,
        });
      });

      producer.on('pause', () => {
        console.log(
          `⏸️ [Producer] Screen audio producer paused for ${this.participant.id}`
        );
        this.notifyConsumers('screen-audio', 'paused', true);
      });

      producer.on('resume', () => {
        console.log(
          `▶️ [Producer] Screen audio producer resumed for ${this.participant.id}`
        );
        this.notifyConsumers('screen-audio', 'paused', false);
      });

      console.log(
        `💻 [Producer] Screen audio producer created for ${this.participant.id}: ${producer.id}`
      );
      this.emit('producer-created', { kind: 'screen-audio', producer });

      return producer;
    } catch (error) {
      console.error(
        `❌ [Producer] Failed to create screen audio producer for ${this.participant.id}:`,
        error
      );
      throw error;
    }
  }

  // Pause producer by kind
  async pauseProducer(kind) {
    try {
      const producer = this.getProducerByKind(kind);
      if (producer && !producer.paused) {
        await producer.pause();
        console.log(
          `⏸️ [Producer] ${kind} producer paused for ${this.participant.id}`
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ [Producer] Failed to pause ${kind} producer:`, error);
      throw error;
    }
  }

  // Resume producer by kind
  async resumeProducer(kind) {
    try {
      const producer = this.getProducerByKind(kind);
      if (producer && producer.paused) {
        await producer.resume();
        console.log(
          `▶️ [Producer] ${kind} producer resumed for ${this.participant.id}`
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ [Producer] Failed to resume ${kind} producer:`, error);
      throw error;
    }
  }

  // Close producer by kind
  async closeProducer(kind) {
    try {
      const producer = this.getProducerByKind(kind);
      if (producer) {
        producer.close();
        this.setProducerByKind(kind, null);
        console.log(
          `🔴 [Producer] ${kind} producer closed for ${this.participant.id}`
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ [Producer] Failed to close ${kind} producer:`, error);
      throw error;
    }
  }

  // Get producer by kind
  getProducerByKind(kind) {
    switch (kind) {
      case 'audio':
        return this.audioProducer;
      case 'video':
        return this.videoProducer;
      case 'screen-video':
        return this.screenVideoProducer;
      case 'screen-audio':
        return this.screenAudioProducer;
      default:
        return null;
    }
  }

  // Set producer by kind
  setProducerByKind(kind, producer) {
    switch (kind) {
      case 'audio':
        this.audioProducer = producer;
        break;
      case 'video':
        this.videoProducer = producer;
        break;
      case 'screen-video':
        this.screenVideoProducer = producer;
        break;
      case 'screen-audio':
        this.screenAudioProducer = producer;
        break;
    }
  }

  // Notify consumers about producer state changes
  notifyConsumers(kind, event, data) {
    // The room will handle notifying other participants
    this.emit('notify-consumers', {
      participantId: this.participant.id,
      kind,
      event,
      data,
    });
  }

  // Get all active producers
  getActiveProducers() {
    const producers = {};
    if (this.audioProducer) producers.audio = this.audioProducer;
    if (this.videoProducer) producers.video = this.videoProducer;
    if (this.screenVideoProducer)
      producers.screenVideo = this.screenVideoProducer;
    if (this.screenAudioProducer)
      producers.screenAudio = this.screenAudioProducer;
    return producers;
  }

  // Close all producers
  closeAll() {
    console.log(
      `🔴 [Producer] Closing all producers for ${this.participant.id}`
    );

    if (this.audioProducer) {
      this.audioProducer.close();
      this.audioProducer = null;
    }

    if (this.videoProducer) {
      this.videoProducer.close();
      this.videoProducer = null;
    }

    if (this.screenVideoProducer) {
      this.screenVideoProducer.close();
      this.screenVideoProducer = null;
    }

    if (this.screenAudioProducer) {
      this.screenAudioProducer.close();
      this.screenAudioProducer = null;
    }
  }
}
