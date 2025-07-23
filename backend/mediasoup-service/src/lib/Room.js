import { EventEmitter } from 'events';
import { Participant } from './Participant.js';

export class Room extends EventEmitter {
  constructor(roomId, router) {
    super();
    this.roomId = roomId;
    this.router = router;
    this.participants = new Map();
    this.closed = false;

    console.log(`🏠 [Room] Created room: ${roomId}`);
  }

  // Add a participant to the room
  async addParticipant(participantId, transport, socket, userInfo) {
    if (this.closed) {
      throw new Error('Room is closed');
    }

    if (this.participants.has(participantId)) {
      console.warn(
        `⚠️ [Room] Participant ${participantId} already exists in room ${this.roomId}`
      );
      return this.participants.get(participantId);
    }

    // Pass room reference to participant
    const participant = new Participant(
      participantId,
      transport,
      socket,
      userInfo,
      this
    );
    this.participants.set(participantId, participant);

    console.log(
      `👤 [Room] Added participant ${participantId} to room ${this.roomId} (Total: ${this.participants.size})`
    );

    // Set up participant event handlers
    participant.on('close', () => {
      this.removeParticipant(participantId);
    });

    participant.on('producer-created', (producer) => {
      this.handleNewProducer(participantId, producer);
    });

    participant.on('producer-closed', (producerId) => {
      this.handleProducerClosed(participantId, producerId);
    });

    participant.on('notify-consumers', (data) => {
      this.handleNotifyConsumers(data);
    });

    // Notify other participants about the new participant
    this.notifyParticipants(
      'participant-joined',
      {
        participantId,
        userInfo: participant.userInfo,
      },
      participantId
    );

    // Send existing participants to the new participant
    await this.sendExistingParticipants(participant);

    this.emit('participant-added', participant);
    return participant;
  }

  // Remove a participant from the room
  removeParticipant(participantId) {
    const participant = this.participants.get(participantId);
    if (!participant) {
      return;
    }

    console.log(
      `👤 [Room] Removing participant ${participantId} from room ${this.roomId}`
    );

    // Close participant (this will close all producers and consumers)
    participant.close();
    this.participants.delete(participantId);

    // Notify other participants
    this.notifyParticipants(
      'participant-left',
      { participantId },
      participantId
    );

    console.log(
      `👤 [Room] Participant ${participantId} removed. Remaining: ${this.participants.size}`
    );

    // Close room if no participants left
    if (this.participants.size === 0) {
      this.close();
    }

    this.emit('participant-removed', participantId);
  }

  // Handle new producer from a participant
  async handleNewProducer(participantId, producer) {
    console.log(
      `📹 [Room] New ${producer.kind} producer from ${participantId}: ${producer.id}`
    );

    // Create consumers for this producer on all other participants
    const consumerPromises = [];
    for (const [otherParticipantId, otherParticipant] of this.participants) {
      if (
        otherParticipantId !== participantId &&
        otherParticipant.rtpCapabilities
      ) {
        consumerPromises.push(
          this.createConsumer(otherParticipant, producer, participantId).catch(
            (error) => {
              console.error(
                `❌ [Room] Failed to create consumer for ${otherParticipantId}:`,
                error
              );
            }
          )
        );
      }
    }

    // Wait for all consumers to be created
    await Promise.all(consumerPromises);
  }

  // Handle producer closure
  handleProducerClosed(participantId, producerId) {
    console.log(
      `📹 [Room] Producer ${producerId} closed for participant ${participantId}`
    );

    // Close consumers for this producer on all other participants
    for (const [otherParticipantId, otherParticipant] of this.participants) {
      if (otherParticipantId !== participantId) {
        otherParticipant.closeConsumerByProducer(producerId);
      }
    }

    // Notify all participants about the closed producer
    this.notifyParticipants('producer-closed', {
      participantId,
      producerId,
    });
  }

  // Handle consumer notifications
  handleNotifyConsumers(data) {
    const { participantId, kind, event, data: eventData } = data;

    // Notify all other participants about producer state changes
    this.notifyParticipants(
      'producer-state-changed',
      {
        participantId,
        kind,
        event,
        data: eventData,
      },
      participantId
    );
  }

  // Create a consumer for a participant
  async createConsumer(participant, producer, producerParticipantId) {
    try {
      // Check if participant can consume this producer
      if (
        !this.router.canConsume({
          producerId: producer.id,
          rtpCapabilities: participant.rtpCapabilities,
        })
      ) {
        console.warn(
          `⚠️ [Room] Participant ${participant.id} cannot consume producer ${producer.id}`
        );
        return null;
      }

      // Use the participant's consumer handler
      const consumer = await participant.createConsumer(
        producer,
        producerParticipantId
      );

      console.log(
        `🎬 [Room] Created consumer ${consumer?.id} for participant ${participant.id}`
      );
      return consumer;
    } catch (error) {
      console.error(`❌ [Room] Failed to create consumer:`, error);
      throw error;
    }
  }

  // Send existing participants to a new participant
  async sendExistingParticipants(newParticipant) {
    const existingParticipants = [];

    for (const [participantId, participant] of this.participants) {
      if (participantId !== newParticipant.id) {
        const participantInfo = {
          participantId,
          userInfo: participant.userInfo,
          producers: [],
        };

        // Get all producers from this participant
        const producers = participant.getProducers();
        for (const producer of producers) {
          participantInfo.producers.push({
            producerId: producer.id,
            kind: producer.kind,
            appData: producer.appData,
          });

          // Create consumer for each producer if new participant has RTP capabilities
          if (newParticipant.rtpCapabilities) {
            try {
              await this.createConsumer(
                newParticipant,
                producer,
                participantId
              );
            } catch (error) {
              console.error(
                `❌ [Room] Failed to create consumer for existing producer:`,
                error
              );
            }
          }
        }

        existingParticipants.push(participantInfo);
      }
    }

    // Send to new participant
    newParticipant.socket.emit('existing-participants', {
      participants: existingParticipants,
    });
  }

  // Create consumers for new RTP capabilities
  async createConsumersForParticipant(participant) {
    console.log(
      `🔄 [Room] Creating consumers for participant ${participant.id} with new RTP capabilities`
    );

    const consumerPromises = [];

    for (const [otherParticipantId, otherParticipant] of this.participants) {
      if (otherParticipantId !== participant.id) {
        const producers = otherParticipant.getProducers();
        for (const producer of producers) {
          consumerPromises.push(
            this.createConsumer(
              participant,
              producer,
              otherParticipantId
            ).catch((error) => {
              console.error(
                `❌ [Room] Failed to create consumer for existing producer:`,
                error
              );
            })
          );
        }
      }
    }

    await Promise.all(consumerPromises);
  }

  // Notify all participants except the excluded one
  notifyParticipants(event, data, excludeParticipantId = null) {
    for (const [participantId, participant] of this.participants) {
      if (participantId !== excludeParticipantId) {
        participant.socket.emit(event, data);
      }
    }
  }

  // Get participant by ID
  getParticipant(participantId) {
    return this.participants.get(participantId);
  }

  // Get all participants
  getParticipants() {
    return Array.from(this.participants.values());
  }

  // Get participant count
  getParticipantCount() {
    return this.participants.size;
  }

  // Get room stats
  getStats() {
    const participantStats = Array.from(this.participants.values()).map((p) =>
      p.getStats()
    );

    return {
      roomId: this.roomId,
      participantCount: this.participants.size,
      totalProducers: participantStats.reduce(
        (total, p) => total + Object.keys(p.producers).length,
        0
      ),
      totalConsumers: participantStats.reduce(
        (total, p) => total + p.consumers.totalConsumers,
        0
      ),
      participants: participantStats,
    };
  }

  // Close the room
  close() {
    if (this.closed) {
      return;
    }

    console.log(`🏠 [Room] Closing room: ${this.roomId}`);
    this.closed = true;

    // Close all participants
    for (const participant of this.participants.values()) {
      participant.close();
    }

    this.participants.clear();
    this.emit('close');
  }
}
