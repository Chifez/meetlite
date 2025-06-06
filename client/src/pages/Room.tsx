import { useParams, useNavigate } from 'react-router-dom';
import { VideoGrid } from '@/components/room/VideoGrid';
import { RoomControls } from '@/components/room/RoomControls';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useScreenShareRTC } from '@/hooks/useScreenShareRTC';
import { useSocketSetup } from '@/hooks/useSocketSetup';
import { useScreenShare } from '@/hooks/useScreenShare';
import { useMediaSetup } from '@/hooks/useMediaSetup';
import SEO from '@/components/SEO';
import { RoomProvider } from '@/contexts/RoomContext';

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // Setup socket connection
  const { socket } = useSocketSetup({ roomId });

  // Setup screen sharing
  const { screenShareState, shareScreen, cleanupScreenShare } = useScreenShare({
    socket,
    roomId,
  });

  // Setup media first
  const { localStream, mediaState, toggleAudio, toggleVideo } = useMediaSetup({
    socket,
    roomId,
  });

  // Use WebRTC hooks with localStream
  const { peers, peerMediaState } = useWebRTC(socket, localStream);
  const { screenPeers } = useScreenShareRTC(socket, screenShareState.stream);

  // Leave meeting function
  const leaveMeeting = () => {
    cleanupScreenShare();

    peers.forEach((peer) => {
      peer.connection.close();
    });

    if (socket?.connected) {
      socket.emit('user-left', { roomId });
    }
    navigate('/dashboard');
  };

  // Create context value
  const contextValue = {
    socket,
    localStream,
    screenStream: screenShareState.stream,
    peers,
    screenPeers,
    audioEnabled: mediaState.audioEnabled,
    videoEnabled: mediaState.videoEnabled,
    peerMediaState,
    isScreenSharing: screenShareState.isSharing,
    screenSharingUser: screenShareState.sharingUser,
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
        ogUrl={`https://meetlit.netlify.app/room/${roomId}`}
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
