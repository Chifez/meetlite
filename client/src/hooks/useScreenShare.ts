import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSound } from '@/hooks/useSound';
import { Socket } from 'socket.io-client';

interface ScreenShareState {
  stream: MediaStream | null;
  isSharing: boolean;
  sharingUser: string | null;
}

interface UseScreenShareProps {
  socket: Socket | null;
  roomId: string | undefined;
}

export const useScreenShare = ({ socket, roomId }: UseScreenShareProps) => {
  const { toast } = useToast();
  const { playUserJoinSound, playUserLeaveSound } = useSound();

  const [screenShareState, setScreenShareState] = useState<ScreenShareState>({
    stream: null,
    isSharing: false,
    sharingUser: null,
  });

  // Handle screen sharing events
  useEffect(() => {
    if (!socket) return;

    const handleScreenShareStarted = (data: { userId: string }) => {
      setScreenShareState((prev) => ({ ...prev, sharingUser: data.userId }));
    };

    const handleScreenShareStopped = () => {
      setScreenShareState((prev) => ({ ...prev, sharingUser: null }));
    };

    const handleUserJoined = () => {
      playUserJoinSound();
    };

    const handleUserLeft = () => {
      playUserLeaveSound();
    };

    socket.on('screen-share-started', handleScreenShareStarted);
    socket.on('screen-share-stopped', handleScreenShareStopped);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('screen-share-started', handleScreenShareStarted);
      socket.off('screen-share-stopped', handleScreenShareStopped);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, playUserJoinSound, playUserLeaveSound]);

  // Effect to signal server when screen stream is ready for connections
  useEffect(() => {
    if (!socket || !roomId) return;

    if (screenShareState.stream && screenShareState.isSharing) {
      socket.emit('screen-share-ready', { roomId });
    }
  }, [socket, roomId, screenShareState.stream, screenShareState.isSharing]);

  // Share screen function
  const shareScreen = async () => {
    try {
      if (
        screenShareState.sharingUser &&
        screenShareState.sharingUser !== socket?.id
      ) {
        toast({
          variant: 'destructive',
          title: 'Screen Sharing Not Available',
          description: 'Another user is already sharing their screen.',
        });
        return;
      }

      if (screenShareState.isSharing) {
        if (screenShareState.stream) {
          screenShareState.stream.getTracks().forEach((track) => track.stop());
          setScreenShareState({
            stream: null,
            isSharing: false,
            sharingUser: null,
          });
          socket?.emit('screen-share-stopped', { roomId });
        }
      } else {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        stream.getVideoTracks()[0].onended = () => {
          stream.getTracks().forEach((track) => track.stop());
          setScreenShareState({
            stream: null,
            isSharing: false,
            sharingUser: null,
          });
          socket?.emit('screen-share-stopped', { roomId });
        };

        setScreenShareState({
          stream,
          isSharing: true,
          sharingUser: socket?.id || null,
        });
        socket?.emit('screen-share-started', { roomId });
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
      toast({
        variant: 'destructive',
        title: 'Screen Sharing Failed',
        description: 'Could not share your screen. Please try again.',
      });
    }
  };

  // Leave meeting cleanup
  const cleanupScreenShare = () => {
    if (screenShareState.stream) {
      screenShareState.stream.getTracks().forEach((track) => track.stop());
      setScreenShareState({
        stream: null,
        isSharing: false,
        sharingUser: null,
      });
    }
  };

  return {
    screenShareState,
    shareScreen,
    cleanupScreenShare,
  };
};
