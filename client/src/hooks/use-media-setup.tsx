import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';

interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface UseMediaSetupProps {
  socket: Socket | null;
  roomId: string | undefined;
}

export const useMediaSetup = ({ socket, roomId }: UseMediaSetupProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaState, setMediaState] = useState<MediaState>({
    audioEnabled: sessionStorage.getItem('meetlite_audio_enabled') !== 'false',
    videoEnabled: sessionStorage.getItem('meetlite_video_enabled') !== 'false',
  });

  // Initial media setup
  useEffect(() => {
    if (!socket || !roomId) return;

    const setupMedia = async () => {
      try {
        const audioDeviceId =
          sessionStorage.getItem('meetlite_audio_device') || undefined;
        const videoDeviceId =
          sessionStorage.getItem('meetlite_video_device') || undefined;

        const constraints = {
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        const savedAudioEnabled =
          sessionStorage.getItem('meetlite_audio_enabled') !== 'false';
        const savedVideoEnabled =
          sessionStorage.getItem('meetlite_video_enabled') !== 'false';

        stream.getAudioTracks().forEach((track) => {
          track.enabled = savedAudioEnabled;
        });

        stream.getVideoTracks().forEach((track) => {
          track.enabled = savedVideoEnabled;
        });

        setMediaState({
          audioEnabled: savedAudioEnabled,
          videoEnabled: savedVideoEnabled,
        });

        setLocalStream(stream);

        socket.emit('ready', {
          roomId,
          mediaState: {
            audioEnabled: savedAudioEnabled,
            videoEnabled: savedVideoEnabled,
          },
        });
      } catch (error) {
        console.error('Error accessing media devices:', error);
        toast({
          variant: 'destructive',
          title: 'Media Error',
          description:
            'Could not access camera or microphone. Please check permissions.',
        });
        navigate('/lobby/' + roomId);
      }
    };

    setupMedia();
  }, [socket, roomId, toast, navigate]);

  // Toggle audio
  const toggleAudio = () => {
    if (localStream && socket && roomId) {
      const newAudioEnabled = !mediaState.audioEnabled;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = newAudioEnabled;
      });
      setMediaState((prev) => ({ ...prev, audioEnabled: newAudioEnabled }));

      sessionStorage.setItem('meetlite_audio_enabled', String(newAudioEnabled));

      socket.emit('media-state-change', {
        roomId,
        audioEnabled: newAudioEnabled,
        videoEnabled: mediaState.videoEnabled,
      });
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream && socket && roomId) {
      const newVideoEnabled = !mediaState.videoEnabled;
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = newVideoEnabled;
      });
      setMediaState((prev) => ({ ...prev, videoEnabled: newVideoEnabled }));

      sessionStorage.setItem('meetlite_video_enabled', String(newVideoEnabled));

      socket.emit('media-state-change', {
        roomId,
        audioEnabled: mediaState.audioEnabled,
        videoEnabled: newVideoEnabled,
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [localStream]);

  return {
    localStream,
    mediaState,
    toggleAudio,
    toggleVideo,
  };
};
