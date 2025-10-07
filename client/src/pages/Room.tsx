import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useCallback } from 'react';
import { VideoGrid } from '@/components/room/video-grid';
import { RoomControls } from '@/components/room/room-controls';
import { ChatPanel } from '@/components/chat/chat-panel';
import { useMediaSoup } from '@/hooks/use-mediasoup';
import { useWebRTC } from '@/hooks/use-web-rtc';
import { useScreenShareRTC } from '@/hooks/use-screen-share-rtc';
import { useSocketSetup } from '@/hooks/use-socket-setup';
import { useScreenShare } from '@/hooks/use-screen-share';
import { useMediaSetup } from '@/hooks/use-media-setup';
import { useParticipantInfo } from '@/hooks/use-participants-info';
import { useChat } from '@/hooks/use-chat';
import { useCollaboration } from '@/hooks/use-collaboration';
import SEO from '@/components/seo';
import { RoomProvider } from '@/contexts/room-context';
import { WorkflowPanel } from '@/components/room/collaboration/workflow-panel';
import { WhiteboardPanel } from '@/components/room/collaboration/whiteboard-panel';
import { SharedPresentation } from '@/components/room/shared-presentation';
import { ParticipantsContainer } from '@/components/room/participants-container';
import { useAuth } from '@/hooks/use-auth';

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

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
    startPresenting,
    stopPresenting,
    updateCollaborationSettings,
    canEdit,
  } = useCollaboration({ socket, roomId });

  // Use MediaSoup hook with localStream and participant info callback
  const { peers: mediaSoupPeers, isConnected: isMediaSoupConnected } =
    useMediaSoup(socket, localStream, roomId, updateParticipantInfo);

  // Fallback to P2P WebRTC if MediaSoup is not connected
  const { peers: p2pPeers, peerMediaState } = useWebRTC(
    socket,
    localStream,
    updateParticipantInfo
  );
  const { screenPeers } = useScreenShareRTC(socket, screenShareState.stream);

  // Use MediaSoup peers if connected, otherwise fallback to P2P
  const peers = isMediaSoupConnected ? mediaSoupPeers : p2pPeers;

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
      isMediaSoupConnected,
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
      // Presenter functionality
      startPresenting,
      stopPresenting,
      updateCollaborationSettings,
      canEdit,
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
      isMediaSoupConnected,
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
      startPresenting,
      stopPresenting,
      updateCollaborationSettings,
      canEdit,
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
              {collaborationState?.mode === 'workflow' ? (
                // Check if current user is the presenter
                collaborationState?.presenter?.userId === user?.id ? (
                  // Presenter: Full screen workflow
                  <WorkflowPanel className="w-full h-full" />
                ) : (
                  // Viewer: Split layout with workflow + participants (like screen sharing)
                  <div className="flex flex-col w-full h-full overflow-hidden">
                    {/* Mobile: Presentation takes 65% height */}
                    <div className="md:hidden w-full h-[65%] mb-2 flex-shrink-0">
                      <SharedPresentation mode="workflow" />
                    </div>

                    {/* Layout Container */}
                    <div className="md:flex md:flex-row md:h-full h-[35%]">
                      {/* Mobile: Participants */}
                      <div className="md:hidden w-full h-full">
                        <ParticipantsContainer />
                      </div>
                      {/* Desktop: Shared Presentation */}
                      <div className="hidden md:block w-[68%] h-full flex-shrink-0 pr-2">
                        <SharedPresentation mode="workflow" />
                      </div>

                      {/* Participants Container */}
                      <div className="md:w-[32%] h-full flex-1 overflow-hidden">
                        <ParticipantsContainer />
                      </div>
                    </div>
                  </div>
                )
              ) : collaborationState?.mode === 'whiteboard' ? (
                // Check if current user is the presenter
                collaborationState?.presenter?.userId === user?.id ? (
                  // Presenter: Full screen whiteboard
                  <WhiteboardPanel className="w-full h-full" />
                ) : (
                  // Viewer: Split layout with whiteboard + participants (like screen sharing)
                  <div className="flex flex-col w-full h-full overflow-hidden">
                    {/* Mobile: Presentation takes 65% height */}
                    <div className="md:hidden w-full h-[65%] mb-2 flex-shrink-0">
                      <SharedPresentation mode="whiteboard" />
                    </div>

                    {/* Layout Container */}
                    <div className="md:flex md:flex-row md:h-full h-[35%]">
                      {/* Mobile: Participants */}
                      <div className="md:hidden w-full h-full">
                        <ParticipantsContainer />
                      </div>
                      {/* Desktop: Shared Presentation */}
                      <div className="hidden md:block w-[68%] h-full flex-shrink-0 pr-2">
                        <SharedPresentation mode="whiteboard" />
                      </div>

                      {/* Participants Container */}
                      <div className="md:w-[32%] h-full flex-1 overflow-hidden">
                        <ParticipantsContainer />
                      </div>
                    </div>
                  </div>
                )
              ) : (
                // No presentation mode: Regular video grid
                <VideoGrid />
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
