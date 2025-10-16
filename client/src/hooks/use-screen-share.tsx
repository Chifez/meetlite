import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSound } from '@/hooks/use-sound';
import { Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/use-auth';

interface ScreenShareState {
  stream: MediaStream | null;
  isSharing: boolean;
  sharingUser: string | null;
}

interface UseScreenShareProps {
  socket: Socket | null;
  roomId: string | undefined;
  produceScreenStream?: (stream: MediaStream) => Promise<any>;
  stopScreenProduction?: () => Promise<void>;
  screenSharingUserId?: string | null;
}

export const useScreenShare = ({
  socket,
  roomId,
  produceScreenStream,
  stopScreenProduction,
  screenSharingUserId,
}: UseScreenShareProps) => {
  const { toast } = useToast();
  const { playUserJoinSound, playUserLeaveSound } = useSound();
  const { user } = useAuth();

  const [screenShareState, setScreenShareState] = useState<ScreenShareState>({
    stream: null,
    isSharing: false,
    sharingUser: screenSharingUserId || null,
  });

  // Sync sharingUser with screenSharingUserId from MediaSoup
  useEffect(() => {
    if (screenSharingUserId !== undefined) {
      setScreenShareState((prev) => ({
        ...prev,
        sharingUser: screenSharingUserId,
      }));
    }
  }, [screenSharingUserId]);

  // Handle sound effects
  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = () => {
      playUserJoinSound();
    };

    const handleUserLeft = () => {
      playUserLeaveSound();
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, playUserJoinSound, playUserLeaveSound]);

  // Share screen function using MediaSoup
  const shareScreen = useCallback(async () => {
    try {
      if (
        screenShareState.sharingUser &&
        screenShareState.sharingUser !== user?.id
      ) {
        toast({
          variant: 'destructive',
          title: 'Screen Sharing Not Available',
          description: 'Another user is already sharing their screen.',
        });
        return;
      }

      if (screenShareState.isSharing) {
        // Stop sharing
        if (screenShareState.stream) {
          // Stop browser tracks
          screenShareState.stream.getTracks().forEach((track) => track.stop());

          // Stop MediaSoup production
          if (stopScreenProduction) {
            await stopScreenProduction();
          }

          // Notify server
          socket?.emit('screen-share-stopped', { roomId });

          // Update local state
          setScreenShareState({
            stream: null,
            isSharing: false,
            sharingUser: null,
          });
        }
      } else {
        // Start sharing
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        });

        // Handle user clicking browser's stop sharing button
        stream.getVideoTracks()[0].onended = async () => {
          stream.getTracks().forEach((track) => track.stop());

          if (stopScreenProduction) {
            await stopScreenProduction();
          }

          socket?.emit('screen-share-stopped', { roomId });

          setScreenShareState({
            stream: null,
            isSharing: false,
            sharingUser: null,
          });
        };

        // Update local state
        setScreenShareState({
          stream,
          isSharing: true,
          sharingUser: user?.id || null,
        });

        // Notify server we're starting
        socket?.emit('screen-share-started', { roomId });

        // Produce through MediaSoup
        if (produceScreenStream) {
          await produceScreenStream(stream);
          console.log('✅ Screen share produced through MediaSoup');
        }
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
      toast({
        variant: 'destructive',
        title: 'Screen Sharing Failed',
        description: 'Could not share your screen. Please try again.',
      });
    }
  }, [
    screenShareState,
    user,
    socket,
    roomId,
    produceScreenStream,
    stopScreenProduction,
    toast,
  ]);

  // Leave meeting cleanup
  const cleanupScreenShare = useCallback(async () => {
    if (screenShareState.stream) {
      screenShareState.stream.getTracks().forEach((track) => track.stop());

      if (stopScreenProduction) {
        await stopScreenProduction();
      }

      setScreenShareState({
        stream: null,
        isSharing: false,
        sharingUser: null,
      });
    }
  }, [screenShareState.stream, stopScreenProduction]);

  return {
    screenShareState,
    shareScreen,
    cleanupScreenShare,
  };
};
