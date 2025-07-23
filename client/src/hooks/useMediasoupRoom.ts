import { useState, useEffect, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { useMediasoup } from './useMediasoup';

interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface UseMediasoupRoomProps {
  socket: Socket | null;
  localStream: MediaStream | null;
  roomId?: string;
  onParticipantInfoUpdate?: (
    info: Record<string, { email: string; userId: string }>
  ) => void;
}

export const useMediasoupRoom = ({
  socket,
  localStream,
  roomId: propRoomId,
  onParticipantInfoUpdate,
}: UseMediasoupRoomProps) => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // 🔍 LOGGING: Hook initialization
  console.log('🏠 [MediasoupRoom] Hook initialized with:', {
    hasSocket: !!socket,
    socketConnected: socket?.connected,
    hasLocalStream: !!localStream,
    propRoomId,
    currentRoomId: roomId,
    isJoining,
  });

  // Use the mediasoup hook
  const {
    peers,
    peerMediaState,
    isConnected,
    connectionState,
    joinRoom: mediasoupJoinRoom,
    pauseProducer,
    resumeProducer,
  } = useMediasoup({
    socket,
    localStream,
    onParticipantInfoUpdate,
  });

  // 🔍 LOGGING: Connection state changes
  useEffect(() => {
    console.log('🔗 [MediasoupRoom] Connection state changed:', {
      isConnected,
      connectionState,
      peerCount: peers.size,
      hasLocalStream: !!localStream,
    });
  }, [isConnected, connectionState, peers.size, localStream]);

  // Join room function that handles the complete flow
  const joinRoom = useCallback(
    async (targetRoomId: string) => {
      console.log('🚀 [MediasoupRoom] JOIN ATTEMPT STARTED:', {
        targetRoomId,
        hasSocket: !!socket,
        socketConnected: socket?.connected,
        isJoining,
        hasLocalStream: !!localStream,
      });

      if (!socket || isJoining) {
        console.warn('⚠️ [MediasoupRoom] Cannot join room:', {
          hasSocket: !!socket,
          socketConnected: socket?.connected,
          isJoining,
          reason: !socket ? 'No socket' : 'Already joining',
        });
        return;
      }

      try {
        setIsJoining(true);
        setJoinError(null);
        setRoomId(targetRoomId);

        console.log(
          '🏠 [MediasoupRoom] Starting mediasoup room join for:',
          targetRoomId
        );

        // Join the mediasoup room
        await mediasoupJoinRoom(targetRoomId);

        console.log('✅ [MediasoupRoom] SUCCESSFULLY JOINED ROOM:', {
          roomId: targetRoomId,
          isConnected,
          connectionState,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to join room';
        console.error('❌ [MediasoupRoom] ROOM JOIN FAILED:', {
          roomId: targetRoomId,
          error: errorMessage,
          errorDetails: error,
        });
        setJoinError(errorMessage);
        setRoomId(null);
      } finally {
        setIsJoining(false);
        console.log('🏁 [MediasoupRoom] Join attempt completed:', {
          roomId: targetRoomId,
          success: !joinError,
          isConnected,
        });
      }
    },
    [
      socket,
      isJoining,
      mediasoupJoinRoom,
      isConnected,
      connectionState,
      joinError,
    ]
  );

  // Auto-join room when socket and localStream are available
  useEffect(() => {
    console.log('🔄 [MediasoupRoom] Auto-join check:', {
      hasSocket: !!socket,
      socketConnected: socket?.connected,
      hasLocalStream: !!localStream,
      propRoomId,
      currentRoomId: roomId,
      isJoining,
      shouldJoin: socket && localStream && propRoomId && !roomId && !isJoining,
    });

    if (socket && localStream && propRoomId && !roomId && !isJoining) {
      console.log('🚀 [MediasoupRoom] AUTO-JOINING ROOM:', propRoomId);
      joinRoom(propRoomId);
    }
  }, [socket, localStream, propRoomId, roomId, isJoining, joinRoom]);

  // 🔍 LOGGING: Socket connection events
  useEffect(() => {
    if (!socket) return;

    console.log('📡 [MediasoupRoom] Setting up socket listeners');

    const handleConnect = () => {
      console.log('✅ [MediasoupRoom] Socket connected!');
    };

    const handleDisconnect = (reason: string) => {
      console.log('❌ [MediasoupRoom] Socket disconnected:', reason);
    };

    const handleError = (error: any) => {
      console.error('💥 [MediasoupRoom] Socket error:', error);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
    };
  }, [socket]);

  // Handle media control
  const toggleAudio = useCallback(async () => {
    try {
      if (!localStream) return;

      const audioTrack = localStream.getAudioTracks()[0];
      if (!audioTrack) return;

      const newEnabled = !audioTrack.enabled;
      audioTrack.enabled = newEnabled;

      // Control producer on server
      if (newEnabled) {
        await resumeProducer('audio');
      } else {
        await pauseProducer('audio');
      }

      // Emit media state change to other participants
      if (socket && roomId) {
        socket.emit('media-state-change', {
          roomId,
          audioEnabled: newEnabled,
          videoEnabled: localStream.getVideoTracks()[0]?.enabled || false,
        });
      }

      console.log(
        `🎵 [MediasoupRoom] Audio ${newEnabled ? 'enabled' : 'disabled'}`
      );
    } catch (error) {
      console.error('❌ [MediasoupRoom] Failed to toggle audio:', error);
    }
  }, [localStream, socket, roomId, pauseProducer, resumeProducer]);

  const toggleVideo = useCallback(async () => {
    try {
      if (!localStream) return;

      const videoTrack = localStream.getVideoTracks()[0];
      if (!videoTrack) return;

      const newEnabled = !videoTrack.enabled;
      videoTrack.enabled = newEnabled;

      // Control producer on server
      if (newEnabled) {
        await resumeProducer('video');
      } else {
        await pauseProducer('video');
      }

      // Emit media state change to other participants
      if (socket && roomId) {
        socket.emit('media-state-change', {
          roomId,
          audioEnabled: localStream.getAudioTracks()[0]?.enabled || false,
          videoEnabled: newEnabled,
        });
      }

      console.log(
        `📹 [MediasoupRoom] Video ${newEnabled ? 'enabled' : 'disabled'}`
      );
    } catch (error) {
      console.error('❌ [MediasoupRoom] Failed to toggle video:', error);
    }
  }, [localStream, socket, roomId, pauseProducer, resumeProducer]);

  // Get current media state
  const currentMediaState = useMemo((): MediaState => {
    if (!localStream) {
      return { audioEnabled: false, videoEnabled: false };
    }

    return {
      audioEnabled: localStream.getAudioTracks()[0]?.enabled || false,
      videoEnabled: localStream.getVideoTracks()[0]?.enabled || false,
    };
  }, [localStream]);

  // Connection status for UI
  const connectionStatus = useMemo(() => {
    if (isJoining) return 'joining';
    if (joinError) return 'error';
    if (!isConnected) return 'disconnected';
    return 'connected';
  }, [isJoining, joinError, isConnected]);

  // Debug information
  const debugInfo = useMemo(
    () => ({
      roomId,
      isJoining,
      joinError,
      isConnected,
      connectionState,
      connectionStatus,
      peerCount: peers.size,
      mediaState: currentMediaState,
    }),
    [
      roomId,
      isJoining,
      joinError,
      isConnected,
      connectionState,
      connectionStatus,
      peers.size,
      currentMediaState,
    ]
  );

  return {
    // Core functionality
    peers,
    peerMediaState,
    roomId,

    // Connection state
    isConnected,
    connectionState,
    connectionStatus,
    isJoining,
    joinError,

    // Media controls
    currentMediaState,
    toggleAudio,
    toggleVideo,

    // Room management
    joinRoom,

    // Debug
    debugInfo,
  };
};
