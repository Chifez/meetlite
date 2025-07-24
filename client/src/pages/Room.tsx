import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useCallback } from 'react';
import { VideoGrid } from '@/components/room/VideoGrid';
import { RoomControls } from '@/components/room/RoomControls';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useScreenShareRTC } from '@/hooks/useScreenShareRTC';
import { useSocketSetup } from '@/hooks/useSocketSetup';
import { useScreenShare } from '@/hooks/useScreenShare';
import { useMediaSetup } from '@/hooks/useMediaSetup';
import { useParticipantInfo } from '@/hooks/useParticipantInfo';
import { useChat } from '@/hooks/useChat';
import { useCollaboration } from '@/hooks/useCollaboration';
import { WorkflowPanel } from '@/components/room/collaboration/WorkflowPanel';
import { WhiteboardPanel } from '@/components/room/collaboration/WhiteboardPanel';
import { CollaborationToolbar } from '@/components/room/collaboration/CollaborationToolbar';
import SEO from '@/components/SEO';
import { RoomProvider } from '@/contexts/RoomContext';

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // Setup socket connection
  const { socket } = useSocketSetup({ roomId });

  // Setup participant info management
  const { getParticipantEmail, updateParticipantInfo } = useParticipantInfo();

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

  // Setup chat functionality
  const {
    chatState,
    sendMessage,
    toggleChatPanel,
    markAsRead,
    startTyping,
    stopTyping,
  } = useChat({ socket, roomId });

  // Setup collaboration features
  const {
    collaborationState,
    changeCollaborationMode,
    sendWorkflowOperation,
    sendWhiteboardUpdate,
  } = useCollaboration({ socket, roomId });

  // Use WebRTC hooks with localStream and participant info callback
  const { peers, peerMediaState } = useWebRTC(
    socket,
    localStream,
    updateParticipantInfo
  );
  const { screenPeers } = useScreenShareRTC(socket, screenShareState.stream);

  // Memoized leave meeting function to prevent unnecessary re-renders
  const leaveMeeting = useCallback(() => {
    cleanupScreenShare();

    peers.forEach((peer) => {
      peer.connection.close();
    });

    if (socket?.connected) {
      socket.emit('user-left', { roomId });
    }
    navigate('/dashboard');
  }, [cleanupScreenShare, peers, socket, roomId, navigate]);

  // Memoized navigation callbacks
  const handleRefreshConnection = useCallback(() => {
    window.location.reload();
  }, []);

  const handleReturnToLobby = useCallback(() => {
    navigate(`/lobby/${roomId}`);
  }, [navigate, roomId]);

  // Memoized context value to prevent unnecessary re-renders
  const roomContextValue = useMemo(
    () => ({
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
      getParticipantEmail,
      toggleAudio,
      toggleVideo,
      leaveMeeting,
      shareScreen,
      // Chat functionality
      chatState,
      sendMessage,
      toggleChatPanel,
      markChatAsRead: markAsRead,
      startTyping,
      stopTyping,
      // Collaboration functionality
      collaborationState,
      changeCollaborationMode,
      sendWorkflowOperation,
      sendWhiteboardUpdate,
    }),
    [
      socket,
      localStream,
      screenShareState.stream,
      screenShareState.isSharing,
      screenShareState.sharingUser,
      peers,
      screenPeers,
      mediaState.audioEnabled,
      mediaState.videoEnabled,
      peerMediaState,
      getParticipantEmail,
      toggleAudio,
      toggleVideo,
      leaveMeeting,
      shareScreen,
      chatState,
      sendMessage,
      toggleChatPanel,
      markAsRead,
      startTyping,
      stopTyping,
      collaborationState,
      changeCollaborationMode,
      sendWorkflowOperation,
      sendWhiteboardUpdate,
    ]
  );

  // Memoized SEO props
  const seoProps = useMemo(
    () => ({
      title: `Meeting Room - MeetLite`,
      description: `Join your video conference meeting with high-quality audio and video.`,
      keywords: `video conferencing, online meetings, web conferencing, video chat, remote collaboration`,
      ogUrl: `https://meetlit.netlify.app/room/${roomId}`,
    }),
    [roomId]
  );

  return (
    <>
      <SEO {...seoProps} />
      <RoomProvider value={roomContextValue}>
        <div className="flex h-screen bg-[#121212]">
          {/* Main content area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden bg-[#121212] p-4">
              {collaborationState.mode === 'none' ? (
                <VideoGrid />
              ) : collaborationState.mode === 'workflow' ? (
                <WorkflowPanel className="w-full h-full" />
              ) : (
                <WhiteboardPanel className="w-full h-full" />
              )}
            </div>

            <RoomControls
              onRefreshConnection={handleRefreshConnection}
              onReturnToLobby={handleReturnToLobby}
            />
          </div>

          {/* Chat Panel */}
          <ChatPanel
            chatState={chatState}
            onSendMessage={sendMessage}
            onTogglePanel={toggleChatPanel}
            onMarkAsRead={markAsRead}
            onTypingStart={startTyping}
            onTypingStop={stopTyping}
          />
        </div>
      </RoomProvider>
    </>
  );
};

export default Room;
