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
  enabled?: boolean;
}

export const useMediaSetup = ({ socket, roomId, enabled }: UseMediaSetupProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaState, setMediaState] = useState<MediaState>({
    audioEnabled: sessionStorage.getItem('meetlite_audio_enabled') !== 'false',
    videoEnabled: sessionStorage.getItem('meetlite_video_enabled') !== 'false',
  });

  // Initial media setup
  useEffect(() => {
    const shouldAcquireMedia = enabled ?? Boolean(socket);
    if (!shouldAcquireMedia || !roomId) return;

    let cancelled = false;

    const setupMedia = async () => {
      try {
        const audioDeviceId =
          sessionStorage.getItem('meetlite_audio_device') || undefined;
        const videoDeviceId =
          sessionStorage.getItem('meetlite_video_device') || undefined;

        const constraints = {
          audio: audioDeviceId ? { deviceId: { ideal: audioDeviceId } } : true,
          video: videoDeviceId ? { deviceId: { ideal: videoDeviceId } } : true,
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

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        setMediaState({
          audioEnabled: savedAudioEnabled,
          videoEnabled: savedVideoEnabled,
        });

        setLocalStream(stream);

      } catch (error) {
        if (cancelled) return;
        console.warn('Full media acquisition failed, attempting audio-only:', error);
        try {
          const audioDeviceId =
            sessionStorage.getItem('meetlite_audio_device') || undefined;
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: audioDeviceId ? { deviceId: { ideal: audioDeviceId } } : true,
            video: false,
          });

          if (cancelled) {
            audioStream.getTracks().forEach((track) => track.stop());
            return;
          }

          const savedAudioEnabled =
            sessionStorage.getItem('meetlite_audio_enabled') !== 'false';
          audioStream.getAudioTracks().forEach((track) => {
            track.enabled = savedAudioEnabled;
          });

          setMediaState({
            audioEnabled: savedAudioEnabled,
            videoEnabled: false,
          });
          setLocalStream(audioStream);

          toast({
            title: 'Camera Unavailable',
            description: 'Joined meeting with microphone only.',
          });
        } catch (audioError) {
          if (cancelled) return;
          console.error('Microphone acquisition also failed:', audioError);
          setMediaState({
            audioEnabled: false,
            videoEnabled: false,
          });
          setLocalStream(null);
          toast({
            variant: 'destructive',
            title: 'No Media Devices',
            description: 'Joined meeting as a listener (no camera or microphone).',
          });
        }
      }
    };

    void setupMedia();
    return () => {
      cancelled = true;
    };
  }, [enabled, roomId, toast, navigate]);

  // Room membership signaling is independent from browser media acquisition.
  // Cloudflare rooms can publish even while the legacy collaboration socket reconnects.
  useEffect(() => {
    if (!socket || !roomId || !localStream) return;
    socket.emit('ready', {
      roomId,
      mediaState: {
        audioEnabled: localStream.getAudioTracks()[0]?.enabled ?? false,
        videoEnabled: localStream.getVideoTracks()[0]?.enabled ?? false,
      },
    });
  }, [socket, roomId, localStream]);

  // Toggle audio
  const toggleAudio = () => {
    if (localStream && roomId) {
      const newAudioEnabled = !mediaState.audioEnabled;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = newAudioEnabled;
      });
      setMediaState((prev) => ({ ...prev, audioEnabled: newAudioEnabled }));

      sessionStorage.setItem('meetlite_audio_enabled', String(newAudioEnabled));

      socket?.emit('media-state-change', {
        roomId,
        audioEnabled: newAudioEnabled,
        videoEnabled: mediaState.videoEnabled,
      });
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream && roomId) {
      const newVideoEnabled = !mediaState.videoEnabled;
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = newVideoEnabled;
      });
      setMediaState((prev) => ({ ...prev, videoEnabled: newVideoEnabled }));

      sessionStorage.setItem('meetlite_video_enabled', String(newVideoEnabled));

      socket?.emit('media-state-change', {
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
