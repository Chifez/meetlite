/**
 * useMediaEndpoint React Hook
 *
 * Placed at the architectural seam between Room UI components and underlying WebRTC engines.
 * Consumes the IMediaEndpoint deep module interface and exposes standard React state,
 * maintaining 100% backward compatibility with RoomContext, ResponsiveVideoGrid, and RoomControls.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { PeerConnection } from '@/components/room/types';
import {
  IMediaEndpoint,
  CloudflareMediaEndpoint,
  MediasoupMediaEndpoint,
  MockMediaEndpoint,
  SpatialLayer,
} from '@/lib/media-endpoint';

export type MediaEngineType = 'cloudflare' | 'mediasoup' | 'mock';

export interface UseMediaEndpointOptions {
  enabled?: boolean;
  engine?: MediaEngineType;
  roomId: string | undefined;
  userId: string | undefined;
  localStream: MediaStream | null;
  socket?: Socket | null;
  capabilityToken?: string | null;
  coordinatorWsUrl?: string;
  onParticipantInfoUpdate?: (info: Record<string, { email: string; userId: string }>) => void;
  onParticipantInfoRemove?: (userId: string) => void;
}

export const useMediaEndpoint = ({
  enabled = true,
  engine,
  roomId,
  userId,
  localStream,
  socket,
  capabilityToken,
  coordinatorWsUrl,
  onParticipantInfoRemove,
}: UseMediaEndpointOptions) => {
  // Determine media engine (canary / env / parameter)
  const resolvedEngine: MediaEngineType = useMemo(() => {
    if (engine) return engine;
    const envEngine = (import.meta as any).env?.VITE_MEDIA_ENGINE;
    if (envEngine === 'cloudflare') return 'cloudflare';
    if (envEngine === 'mock') return 'mock';
    return 'mediasoup';
  }, [engine]);

  // Reactive state matching RoomContext expectations
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [peerMediaState, setPeerMediaState] = useState<
    Map<string, { audioEnabled: boolean; videoEnabled: boolean }>
  >(new Map());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [screenSharingUserId, setScreenSharingUserId] = useState<string | null>(null);
  const screenSharingUserIdRef = useRef<string | null>(null);
  screenSharingUserIdRef.current = screenSharingUserId;
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<Record<string, number>>({});
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active publications and subscriptions
  const publishedAudioPubId = useRef<string | null>(null);
  const publishedVideoPubId = useRef<string | null>(null);
  const publishedScreenPubId = useRef<string | null>(null);

  // Reference to current endpoint instance
  const endpointRef = useRef<IMediaEndpoint | null>(null);

  // Factory to create appropriate endpoint
  const createEndpoint = useCallback((): IMediaEndpoint | null => {
    if (!enabled || !roomId) return null;

    if (resolvedEngine === 'mock') {
      return new MockMediaEndpoint(userId || 'local-user');
    }

    if (resolvedEngine === 'cloudflare') {
      if (!capabilityToken) return null;

      const defaultWsUrl =
        coordinatorWsUrl ||
        (import.meta as any).env?.VITE_EDGE_COORDINATOR_URL ||
        (typeof window !== 'undefined' && window.location.protocol === 'https:'
          ? `wss://${window.location.host}/edge/room-coordinator`
          : 'ws://localhost:8787');

      return new CloudflareMediaEndpoint({
        roomId,
        capabilityToken,
        coordinatorWsUrl: defaultWsUrl,
      });
    }

    if (resolvedEngine === 'mediasoup' && socket) {
      return new MediasoupMediaEndpoint({
        socket,
        roomId,
        userId: userId || 'local-user',
      });
    }

    return null;
  }, [resolvedEngine, roomId, userId, socket, capabilityToken, coordinatorWsUrl, enabled]);

  // Connect and lifecycle effect
  useEffect(() => {
    const endpoint = createEndpoint();
    if (!endpoint) return;

    endpointRef.current = endpoint;

    // Wire endpoint events
    const unsubState = endpoint.on('state_changed', ({ state }) => {
      setIsConnected(state === 'connected');
      if (state === 'connected') {
        reconnectAttemptRef.current = 0;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (
        resolvedEngine === 'cloudflare' &&
        enabled &&
        (state === 'failed' || state === 'disconnected') &&
        !reconnectTimerRef.current
      ) {
        setPeers(new Map());
        setPeerMediaState(new Map());
        const delayMs = Math.min(1_000 * 2 ** reconnectAttemptRef.current, 10_000);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          setReconnectVersion((version) => version + 1);
        }, delayMs);
      }
    });

    const unsubTrackAdded = endpoint.on('remote_track_added', (remoteTrack) => {
      if (remoteTrack.kind === 'screen') {
        setScreenShareStream(remoteTrack.stream);
        setScreenSharingUserId(remoteTrack.participantId);
        screenSharingUserIdRef.current = remoteTrack.participantId;
        return;
      }

      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(remoteTrack.participantId);
        const stream = existing?.stream || new MediaStream();

        // Avoid adding duplicate tracks to same stream
        if (!stream.getTracks().some((t) => t.id === remoteTrack.track.id)) {
          stream.addTrack(remoteTrack.track);
        }

        next.set(remoteTrack.participantId, {
          id: remoteTrack.participantId,
          connection: null as any, // Not exposed to views
          stream,
          isLoading: false,
        });
        return next;
      });

      setPeerMediaState((prev) => {
        const next = new Map(prev);
        const current = next.get(remoteTrack.participantId) || {
          audioEnabled: false,
          videoEnabled: false,
        };

        if (remoteTrack.kind === 'audio') current.audioEnabled = true;
        if (remoteTrack.kind === 'video') current.videoEnabled = true;

        next.set(remoteTrack.participantId, current);
        return next;
      });
    });

    const unsubTrackRemoved = endpoint.on('remote_track_removed', ({ trackId, participantId }) => {
      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(participantId);
        if (!existing?.stream) return next;

        const removedTrack = trackId
          ? existing.stream.getTracks().find((track) => track.id === trackId)
          : undefined;
        if (removedTrack) existing.stream.removeTrack(removedTrack);
        if (existing.stream.getTracks().length === 0) {
          next.delete(participantId);
        }
        return next;
      });
    });

    const unsubParticipantLeft = endpoint.on('participant_left', ({ participantId }) => {
      setPeers((prev) => {
        const next = new Map(prev);
        next.delete(participantId);
        return next;
      });

      setPeerMediaState((prev) => {
        const next = new Map(prev);
        next.delete(participantId);
        return next;
      });

      if (screenSharingUserIdRef.current === participantId) {
        setScreenShareStream(null);
        setScreenSharingUserId(null);
        screenSharingUserIdRef.current = null;
      }

      onParticipantInfoRemove?.(participantId);
    });

    const unsubSpeaker = endpoint.on('active_speaker_changed', ({ participantId, audioLevel }) => {
      setActiveSpeakerId(participantId);
      if (participantId) {
        setAudioLevels((prev) => ({ ...prev, [participantId]: audioLevel }));
      }
    });

    // Initiate connection
    endpoint.connect().catch((err) => {
      console.error('MediaEndpoint connection failure:', err);
    });

    return () => {
      unsubState();
      unsubTrackAdded();
      unsubTrackRemoved();
      unsubParticipantLeft();
      unsubSpeaker();
      endpoint.disconnect().catch(() => {});
      endpointRef.current = null;
      publishedAudioPubId.current = null;
      publishedVideoPubId.current = null;
      publishedScreenPubId.current = null;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };
  }, [createEndpoint, enabled, onParticipantInfoRemove, reconnectVersion, resolvedEngine]);

  // Sync local tracks with endpoint when localStream changes
  useEffect(() => {
    const endpoint = endpointRef.current;
    if (!endpoint || !isConnected || !localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    const videoTrack = localStream.getVideoTracks()[0];

    // Publish local audio track
    if (audioTrack && !publishedAudioPubId.current) {
      endpoint
        .publishTrack({ kind: 'audio', track: audioTrack })
        .then((res) => {
          publishedAudioPubId.current = res.publicationId;
        })
        .catch((err) => console.error('Failed to publish local audio track:', err));
    }

    // Publish local video track (with 3-layer simulcast)
    if (videoTrack && !publishedVideoPubId.current) {
      endpoint
        .publishTrack({ kind: 'video', track: videoTrack, simulcast: true })
        .then((res) => {
          publishedVideoPubId.current = res.publicationId;
        })
        .catch((err) => console.error('Failed to publish local video track:', err));
    }
  }, [localStream, isConnected]);

  // Screen sharing operations
  const produceScreenStream = useCallback(async (stream: MediaStream) => {
    const endpoint = endpointRef.current;
    if (!endpoint) throw new Error('MediaEndpoint not connected');

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('No video track in screen stream');

    const res = await endpoint.publishTrack({ kind: 'screen', track: videoTrack });
    publishedScreenPubId.current = res.publicationId;
    setScreenShareStream(stream);
    setScreenSharingUserId(userId || 'local-user');
    return res;
  }, [userId]);

  const stopScreenProduction = useCallback(async () => {
    const endpoint = endpointRef.current;
    if (!endpoint || !publishedScreenPubId.current) return;

    const pubId = publishedScreenPubId.current;
    publishedScreenPubId.current = null;
    await endpoint.withdrawTrack(pubId);
    setScreenShareStream(null);
    setScreenSharingUserId(null);
  }, []);

  // Layer switching
  const setConsumerLayer = useCallback((publicationId: string, spatialLayer: number) => {
    const endpoint = endpointRef.current;
    if (!endpoint) return;

    const layerName: SpatialLayer = spatialLayer === 0 ? 'low' : spatialLayer === 1 ? 'medium' : 'high';
    endpoint.setPreferredLayer(publicationId, layerName).catch(() => {});
  }, []);

  return {
    engine: resolvedEngine,
    peers,
    peerMediaState,
    isConnected,
    screenShareStream,
    screenSharingUserId,
    produceScreenStream,
    stopScreenProduction,
    setConsumerLayer,
    activeSpeakerId,
    audioLevels,
  };
};
