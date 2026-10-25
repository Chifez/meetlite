/**
 * Mediasoup Media Endpoint Adapter
 *
 * Implements IMediaEndpoint for legacy Mediasoup SFU services.
 * Wraps mediasoup-client Device, send/recv transports, producers, and consumers
 * behind the standardized IMediaEndpoint interface.
 */

import { Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import {
  IMediaEndpoint,
  MediaEndpointState,
  MediaEndpointParticipant,
  RemoteParticipantTrack,
  TrackPublicationRequest,
  TrackPublicationResult,
  SpatialLayer,
  MediaEndpointEventMap,
  MediaEndpointEventHandler,
} from './types';

export interface MediasoupMediaEndpointConfig {
  readonly socket: Socket;
  readonly roomId: string;
  readonly userId: string;
}

export class MediasoupMediaEndpoint implements IMediaEndpoint {
  private _state: MediaEndpointState = 'idle';
  private _participantId: string | null = null;
  private readonly _participants = new Map<string, MediaEndpointParticipant>();
  private readonly _remoteTracks = new Map<string, RemoteParticipantTrack>();
  private readonly _eventListeners = new Map<keyof MediaEndpointEventMap, Set<MediaEndpointEventHandler<any>>>();

  private _device: mediasoupClient.types.Device | null = null;
  private _sendTransport: mediasoupClient.types.Transport | null = null;
  private _recvTransport: mediasoupClient.types.Transport | null = null;
  private readonly _producers = new Map<string, mediasoupClient.types.Producer>();
  private readonly _consumers = new Map<string, mediasoupClient.types.Consumer>();

  constructor(private readonly config: MediasoupMediaEndpointConfig) {
    this._participantId = config.userId;
  }

  public get state(): MediaEndpointState {
    return this._state;
  }

  public get participantId(): string | null {
    return this._participantId;
  }

  public get participants(): ReadonlyMap<string, MediaEndpointParticipant> {
    return this._participants;
  }

  public get remoteTracks(): ReadonlyMap<string, RemoteParticipantTrack> {
    return this._remoteTracks;
  }

  public async connect(): Promise<void> {
    if (this._state === 'connected' || this._state === 'connecting') return;

    this.transitionState('connecting');

    try {
      const socket = this.config.socket;
      if (!socket.connected) {
        await new Promise<void>((resolve, reject) => {
          const onConnect = () => {
            cleanup();
            resolve();
          };
          const onError = (err: any) => {
            cleanup();
            reject(err);
          };
          const cleanup = () => {
            socket.off('connect', onConnect);
            socket.off('connect_error', onError);
          };
          socket.once('connect', onConnect);
          socket.once('connect_error', onError);
        });
      }

      // Step 1: Request router RTP capabilities
      const routerRtpCapabilities = await this.emitSocketRequest<mediasoupClient.types.RtpCapabilities>(
        'getRouterRtpCapabilities',
        { roomId: this.config.roomId }
      );

      // Step 2: Initialize Mediasoup Device
      this._device = new mediasoupClient.Device();
      await this._device.load({ routerRtpCapabilities });

      // Step 3: Create Send Transport
      const sendTransportParams = await this.emitSocketRequest<any>('createWebRtcTransport', {
        roomId: this.config.roomId,
        producing: true,
        consuming: false,
      });

      this._sendTransport = this._device.createSendTransport(sendTransportParams);
      this.wireSendTransport(this._sendTransport);

      // Step 4: Create Recv Transport
      const recvTransportParams = await this.emitSocketRequest<any>('createWebRtcTransport', {
        roomId: this.config.roomId,
        producing: false,
        consuming: true,
      });

      this._recvTransport = this._device.createRecvTransport(recvTransportParams);
      this.wireRecvTransport(this._recvTransport);

      // Step 5: Listen for remote producers
      this.wireSocketEvents();

      this.transitionState('connected');
    } catch (err: any) {
      this.transitionState('failed', err);
      this.emit('error', {
        code: 'MEDIASOUP_CONNECT_FAILED',
        message: err.message || 'Failed to connect to Mediasoup',
        fatal: true,
      });
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    if (this._state === 'disconnected' || this._state === 'idle') return;

    this.transitionState('leaving');

    for (const producer of this._producers.values()) {
      producer.close();
    }
    this._producers.clear();

    for (const consumer of this._consumers.values()) {
      consumer.close();
    }
    this._consumers.clear();

    if (this._sendTransport) {
      this._sendTransport.close();
      this._sendTransport = null;
    }

    if (this._recvTransport) {
      this._recvTransport.close();
      this._recvTransport = null;
    }

    this._remoteTracks.clear();
    this._participants.clear();

    this.transitionState('disconnected');
  }

  public async publishTrack(request: TrackPublicationRequest): Promise<TrackPublicationResult> {
    if (this._state !== 'connected' || !this._sendTransport) {
      throw new Error(`Cannot publish track in state: ${this._state}`);
    }

    const producer = await this._sendTransport.produce({
      track: request.track,
      encodings:
        request.kind === 'video' && request.simulcast
          ? [
              { maxBitrate: 150000, scaleResolutionDownBy: 4 },
              { maxBitrate: 500000, scaleResolutionDownBy: 2 },
              { maxBitrate: 1200000 },
            ]
          : undefined,
      appData: { kind: request.kind },
    });

    this._producers.set(producer.id, producer);

    const result: TrackPublicationResult = {
      publicationId: producer.id,
      kind: request.kind,
      sfuTrackId: producer.id,
    };

    this.emit('track_published', { publicationId: producer.id, kind: request.kind });
    return result;
  }

  public async withdrawTrack(publicationId: string): Promise<void> {
    const producer = this._producers.get(publicationId);
    if (!producer) return;

    producer.close();
    this._producers.delete(publicationId);

    try {
      await this.emitSocketRequest('closeProducer', {
        roomId: this.config.roomId,
        producerId: publicationId,
      });
    } catch {}

    this.emit('track_withdrawn', { publicationId });
  }

  public async setPreferredLayer(publicationId: string, layer: SpatialLayer): Promise<void> {
    const consumer = this._consumers.get(publicationId);
    if (!consumer) return;

    const spatialLayer = layer === 'low' ? 0 : layer === 'medium' ? 1 : 2;
    try {
      await this.emitSocketRequest('setConsumerPreferredLayers', {
        roomId: this.config.roomId,
        consumerId: consumer.id,
        spatialLayer,
        temporalLayer: 2,
      });
    } catch {}
  }

  public on<K extends keyof MediaEndpointEventMap>(
    event: K,
    handler: MediaEndpointEventHandler<K>
  ): () => void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off<K extends keyof MediaEndpointEventMap>(
    event: K,
    handler: MediaEndpointEventHandler<K>
  ): void {
    const set = this._eventListeners.get(event);
    if (set) {
      set.delete(handler);
    }
  }

  private wireSendTransport(transport: mediasoupClient.types.Transport): void {
    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.emitSocketRequest('connectWebRtcTransport', {
        roomId: this.config.roomId,
        transportId: transport.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback);
    });

    transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      this.emitSocketRequest<{ id: string }>('produce', {
        roomId: this.config.roomId,
        transportId: transport.id,
        kind,
        rtpParameters,
        appData,
      })
        .then(({ id }) => callback({ id }))
        .catch(errback);
    });
  }

  private wireRecvTransport(transport: mediasoupClient.types.Transport): void {
    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.emitSocketRequest('connectWebRtcTransport', {
        roomId: this.config.roomId,
        transportId: transport.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback);
    });
  }

  private wireSocketEvents(): void {
    const socket = this.config.socket;

    socket.on('new-producer', async ({ producerId, producerUserId, kind }: any) => {
      if (!this._recvTransport || !this._device) return;

      try {
        const { rtpCapabilities } = this._device;
        const consumerParams = await this.emitSocketRequest<any>('consume', {
          roomId: this.config.roomId,
          producerId,
          rtpCapabilities,
        });

        const consumer = await this._recvTransport.consume(consumerParams);
        this._consumers.set(consumer.id, consumer);

        const publicationKind: 'audio' | 'video' | 'screen' =
          kind === 'screen' ? 'screen' : kind === 'video' ? 'video' : 'audio';

        const remoteTrack: RemoteParticipantTrack = {
          publicationId: producerId,
          participantId: producerUserId,
          kind: publicationKind,
          track: consumer.track,
          stream: new MediaStream([consumer.track]),
        };

        this._remoteTracks.set(producerId, remoteTrack);
        this.emit('remote_track_added', remoteTrack);

        await this.emitSocketRequest('resumeConsumer', {
          roomId: this.config.roomId,
          consumerId: consumer.id,
        });
      } catch (err) {
        console.error('Failed to consume Mediasoup producer:', err);
      }
    });

    socket.on('producer-closed', ({ producerId, producerUserId }: any) => {
      const track = this._remoteTracks.get(producerId);
      if (track) {
        this._remoteTracks.delete(producerId);
        this.emit('remote_track_removed', {
          publicationId: producerId,
          participantId: producerUserId,
        });
      }
    });
  }

  private emitSocketRequest<T = any>(event: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.config.socket.emit(event, data, (response: any) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  private transitionState(newState: MediaEndpointState, error?: Error): void {
    this._state = newState;
    this.emit('state_changed', { state: newState, error });
  }

  private emit<K extends keyof MediaEndpointEventMap>(
    event: K,
    payload: MediaEndpointEventMap[K]
  ): void {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(payload);
        } catch (err) {
          console.error(`Error in MediasoupMediaEndpoint event handler for ${event}:`, err);
        }
      }
    }
  }
}
