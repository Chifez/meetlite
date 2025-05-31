import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';
import { VideoGrid } from '@/components/room/VideoGrid';
import { RoomControls } from '@/components/room/RoomControls';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useScreenShareRTC } from '@/hooks/useScreenShareRTC';
import { useSound } from '@/hooks/useSound';
import SEO from '@/components/SEO';
import { env } from '@/config/env';
import { RoomProvider } from '@/contexts/RoomContext';

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

  // Screen sharing state
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharingUser, setScreenSharingUser] = useState<string | null>(
    null
  );

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
    // Don't set socket state until connected

    // Setup event listeners
    newSocket.on('connect', () => {
      console.log('Connected to signaling server');
      console.log('🔗 [Room] Socket ID assigned:', newSocket.id);
      // Now set the socket state to trigger WebRTC hooks
      setSocket(newSocket);
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

  // Use WebRTC hooks - socket is only set when connected and has ID
  const { peers, peerMediaState } = useWebRTC(socket, localStream);
  const { screenPeers } = useScreenShareRTC(socket, screenStream);

  // Sound functionality
  const { playUserJoinSound, playUserLeaveSound } = useSound();

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
    // Stop screen sharing if active
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    }

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
      // Don't allow screen sharing if someone else is already sharing
      if (screenSharingUser && screenSharingUser !== socket?.id) {
        toast({
          variant: 'destructive',
          title: 'Screen Sharing Not Available',
          description: 'Another user is already sharing their screen.',
        });
        return;
      }

      if (isScreenSharing) {
        // Stop screen sharing
        if (screenStream) {
          screenStream.getTracks().forEach((track) => track.stop());
          setScreenStream(null);
          setIsScreenSharing(false);
          socket?.emit('screen-share-stopped', { roomId });
        }
      } else {
        // Start screen sharing
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        // Handle stream stop from browser controls
        stream.getVideoTracks()[0].onended = () => {
          stream.getTracks().forEach((track) => track.stop());
          setScreenStream(null);
          setIsScreenSharing(false);
          socket?.emit('screen-share-stopped', { roomId });
        };

        setScreenStream(stream);
        setIsScreenSharing(true);
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

  // Handle screen sharing events
  useEffect(() => {
    if (!socket) return;

    const handleScreenShareStarted = (data: { userId: string }) => {
      setScreenSharingUser(data.userId);
    };

    const handleScreenShareStopped = () => {
      setScreenSharingUser(null);
    };

    // Handle user joining sound
    const handleUserJoined = (data: { userId: string; userName: string }) => {
      console.log('🔊 [Room] User joined, playing sound:', data);
      playUserJoinSound();

      // Optional: Show a toast notification
      // toast({
      //   title: 'User Joined',
      //   description: `${data.userName} joined the meeting`,
      // });
    };

    // Handle user leaving sound
    const handleUserLeft = (userId: string) => {
      console.log('🔇 [Room] User left, playing sound:', userId);
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
  }, [socket]);

  // Create context value
  const contextValue = {
    socket,
    localStream,
    screenStream,
    peers,
    screenPeers,
    audioEnabled,
    videoEnabled,
    peerMediaState,
    isScreenSharing,
    screenSharingUser,
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
        <div className="flex flex-col h-screen bg-[#121212]">
          <div className="flex-1 overflow-hidden bg-[#121212] p-4">
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
