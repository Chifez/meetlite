import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';
import { VideoGrid } from '@/components/room/VideoGrid';
import { RoomControls } from '@/components/room/RoomControls';
import { useWebRTC } from '@/hooks/useWebRTC';
import { RoomProvider } from '@/components/room/RoomContext';
import SEO from '@/components/SEO';
import { env } from '@/config/env';
const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(
    sessionStorage.getItem('meetlite_audio_enabled') !== 'false'
  );
  const [videoEnabled, setVideoEnabled] = useState<boolean>(
    sessionStorage.getItem('meetlite_video_enabled') !== 'false'
  );

  const socketRef = useRef<Socket | null>(null);

  // Connect to signaling server and set up media
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !roomId) {
      navigate('/dashboard');
      return;
    }

    // Connect to signaling server
    const newSocket = io(env.SIGNALING_SERVER_URL, {
      auth: { token },
      query: { roomId },
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Setup event listeners
    newSocket.on('connect', () => {
      console.log('Connected to signaling server');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Could not connect to meeting server. Please try again.',
      });
      navigate('/dashboard');
    });

    // Get saved device preferences
    const audioDeviceId =
      sessionStorage.getItem('meetlite_audio_device') || undefined;
    const videoDeviceId =
      sessionStorage.getItem('meetlite_video_device') || undefined;

    // Get user media
    const getMedia = async () => {
      try {
        const constraints = {
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Apply saved mute states from session storage
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

        // Set the state to match the actual track states
        setAudioEnabled(savedAudioEnabled);
        setVideoEnabled(savedVideoEnabled);

        setLocalStream(stream);

        // Signal ready to server with initial media state
        newSocket.emit('ready', {
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

    getMedia();

    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId, navigate, toast]);

  // Use WebRTC hook
  const { peers, peerMediaState } = useWebRTC(socket, localStream);

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const newState = !audioEnabled;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = newState;
      });
      setAudioEnabled(newState);

      // Save to session storage
      sessionStorage.setItem('meetlite_audio_enabled', String(newState));

      console.log('[Room] Toggling audio:', newState);
      // Emit media state change
      socket?.emit('media-state-change', {
        roomId,
        audioEnabled: newState,
        videoEnabled,
      });
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const newState = !videoEnabled;
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = newState;
      });
      setVideoEnabled(newState);

      // Save to session storage
      sessionStorage.setItem('meetlite_video_enabled', String(newState));

      console.log('[Room] Toggling video:', newState);
      // Emit media state change
      socket?.emit('media-state-change', {
        roomId,
        audioEnabled,
        videoEnabled: newState,
      });
    }
  };

  // Leave meeting
  const leaveMeeting = () => {
    console.log('[Room] Leaving meeting, socket state:', socket?.connected);
    // Close all peer connections locally
    peers.forEach((peer) => {
      console.log('[Room] Closing peer connection for:', peer.id);
      peer.connection.close();
    });

    if (socket?.connected) {
      socket.emit('user-left', { roomId });
      console.log('[Room] Emitted user-left event');
    }
    navigate('/dashboard');
  };

  // Share screen
  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      // Replace video track with screen track for all peers
      const videoTrack = screenStream.getVideoTracks()[0];

      if (localStream && videoTrack) {
        const senders: any = [];

        // Collect all RTCRtpSenders from all peer connections
        peers.forEach((peer) => {
          peer.connection.getSenders().forEach((sender) => {
            if (sender.track?.kind === 'video') {
              senders.push(sender);
            }
          });
        });

        // Replace track for each sender
        const promises = senders.map(
          (sender: { replaceTrack: (arg0: MediaStreamTrack) => any }) =>
            sender.replaceTrack(videoTrack)
        );

        // Handle user ending screen share
        videoTrack.onended = () => {
          // Get original video track
          const originalVideoTrack = localStream.getVideoTracks()[0];

          if (originalVideoTrack) {
            // Replace screen track with original video track
            senders.forEach(
              (sender: { replaceTrack: (arg0: MediaStreamTrack) => void }) => {
                sender.replaceTrack(originalVideoTrack);
              }
            );
          }
        };

        await Promise.all(promises);

        toast({
          title: 'Screen Sharing',
          description: 'You are now sharing your screen',
        });
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

  // Create context value
  const contextValue = {
    socket,
    localStream,
    peers,
    audioEnabled,
    videoEnabled,
    peerMediaState,
    toggleAudio,
    toggleVideo,
    leaveMeeting,
    shareScreen,
  };

  return (
    <>
      <SEO
        title={`Meeting Room - MeetLite`}
        description={`Join your video conference meeting with high-quality audio and video.`}
        keywords={`video conferencing, online meetings, web conferencing, video chat, remote collaboration`}
        ogUrl={`https://your-domain.com/room/${roomId}`}
      />
      <RoomProvider value={contextValue}>
        <div className="flex flex-col h-screen">
          <div className="flex-1 overflow-hidden bg-background p-4">
            <VideoGrid />
          </div>

          <RoomControls
            onRefreshConnection={() => window.location.reload()}
            onReturnToLobby={() => navigate(`/lobby/${roomId}`)}
          />
        </div>
      </RoomProvider>
    </>
  );
};

export default Room;
