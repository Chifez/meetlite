import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useCallback, useRef, useState } from 'react';
import { ResponsiveVideoGrid } from '@/components/room/responsive-video-grid';
import { RoomControls } from '@/components/room/room-controls';
import { ChatPanel } from '@/components/chat/chat-panel';
import { useMediaSoup } from '@/hooks/use-mediasoup';
import { useWebRTC } from '@/hooks/use-web-rtc';
import { useSocketSetup } from '@/hooks/use-socket-setup';
import { useScreenShare } from '@/hooks/use-screen-share';
import { useMediaSetup } from '@/hooks/use-media-setup';
import { useParticipantInfo } from '@/hooks/use-participants-info';
import { useChat } from '@/hooks/use-chat';
import { useCollaboration } from '@/hooks/use-collaboration';
import { useYjsProvider } from '@/hooks/use-yjs-provider';
import SEO from '@/components/seo';
import { RoomProvider } from '@/contexts/room-context';
import { SharedPresentation } from '@/components/room/shared-presentation';
import { useAuth } from '@/hooks/use-auth';
import { SOCKET_EVENTS, COLLABORATION_MODES } from '@/lib/constants';


const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Setup socket connection
  const { socket, connectionStatus } = useSocketSetup({ roomId });

  // Initialize Yjs provider for real-time collaboration
  useYjsProvider(
    socket,
    roomId,
    user?.id,
    user?.name || user?.email,
    user?.email
  );

  // Setup participant info management
  const {
    getParticipantEmail,
    getParticipantDisplayName,
    updateParticipantInfo,
    removeParticipantInfo,
  } = useParticipantInfo();

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
    // REMOVED: sendCodeUpdate - Code synchronization now handled by pure YJS
    changeCodeLanguage,
    requestCodeSync,
    startPresenting,
    stopPresenting,
    updateCollaborationSettings,
    canEdit,
  } = useCollaboration({ socket, roomId });

  // Use MediaSoup hook with localStream and participant info callback
  const {
    peers: mediaSoupPeers,
    peerMediaState: mediaSoupMediaState,
    isConnected: isMediaSoupConnected,
    screenShareStream,
    screenSharingUserId,
    produceScreenStream,
    stopScreenProduction,
    setConsumerLayer,
    activeSpeakerId,
    audioLevels,
  } = useMediaSoup(
    socket,
    localStream,
    roomId,
    user?.id,
    updateParticipantInfo,
    removeParticipantInfo
  );

  // Setup screen sharing with MediaSoup functions
  const { screenShareState, shareScreen, cleanupScreenShare } = useScreenShare({
    socket,
    roomId,
    produceScreenStream,
    stopScreenProduction,
    screenSharingUserId,
  });

  // Fallback to P2P WebRTC if MediaSoup is not connected
  const { peers: p2pPeers, peerMediaState: p2pMediaState } = useWebRTC(
    socket,
    localStream,
    roomId,
    updateParticipantInfo
  );

  // Dynamic layout states
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);

  // Use MediaSoup peers if connected, otherwise fallback to P2P
  const peers = isMediaSoupConnected ? mediaSoupPeers : p2pPeers;
  const peerMediaState = isMediaSoupConnected
    ? mediaSoupMediaState
    : p2pMediaState;

  // Use MediaSoup screen share stream (no more P2P screen sharing!)
  const actualScreenStream = isMediaSoupConnected
    ? screenShareStream
    : screenShareState.stream;

  // Use ref to avoid dependency on peers Map in leaveMeeting callback
  const peersRef = useRef(peers);
  peersRef.current = peers;

  // Memoized leave meeting function to prevent unnecessary re-renders
  const leaveMeeting = useCallback(() => {
    cleanupScreenShare();

    peersRef.current.forEach((peer) => {
      // CRITICAL FIX: MediaSoup peers have connection: null, check before closing
      if (peer.connection) {
        peer.connection.close();
      }
    });

    if (socket?.connected) {
      socket.emit(SOCKET_EVENTS.USER_LEFT, { roomId });
    }
    navigate('/dashboard');
  }, [cleanupScreenShare, socket, roomId, navigate]);

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
      screenStream: actualScreenStream,
      peers,
      screenPeers: new Map() as any, // Deprecated - screen share now through MediaSoup
      audioEnabled: mediaState.audioEnabled,
      videoEnabled: mediaState.videoEnabled,
      peerMediaState,
      isScreenSharing: screenShareState.isSharing,
      screenSharingUser: screenSharingUserId || screenShareState.sharingUser,
      isMediaSoupConnected,
      getParticipantEmail,
      getParticipantDisplayName,
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
      // REMOVED: sendCodeUpdate - Code synchronization now handled by pure YJS
      changeCodeLanguage,
      requestCodeSync,
      // Presenter functionality
      startPresenting,
      stopPresenting,
      updateCollaborationSettings,
      canEdit,
      setConsumerLayer,
      activeSpeakerId: activeSpeakerId || null,
      audioLevels: audioLevels || {},
      pinnedParticipant,
      setPinnedParticipant,
    }),
    [
      socket,
      localStream,
      actualScreenStream,
      screenShareState.isSharing,
      screenSharingUserId,
      screenShareState.sharingUser,
      peers,
      mediaState.audioEnabled,
      mediaState.videoEnabled,
      peerMediaState,
      isMediaSoupConnected,
      getParticipantEmail,
      getParticipantDisplayName,
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
      // REMOVED: sendCodeUpdate - Code synchronization now handled by pure YJS
      changeCodeLanguage,
      requestCodeSync,
      startPresenting,
      stopPresenting,
      updateCollaborationSettings,
      canEdit,
      setConsumerLayer,
      activeSpeakerId,
      audioLevels,
      pinnedParticipant,
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
        {/* Wrap the entire room in `.dark` so everything automatically uses the official dark tokens */}
        <div className="dark flex h-screen bg-background text-foreground">
          {/* Main content area */}
          <div className="flex flex-col flex-1 overflow-hidden relative">
            {connectionStatus === 'reconnecting' && (
              <div className="absolute top-0 left-0 w-full z-50 bg-yellow-500/90 text-yellow-50 text-sm font-medium py-2 px-4 text-center backdrop-blur-sm shadow-md animate-in slide-in-from-top-4">
                Reconnecting... Please wait.
              </div>
            )}
            <div className="flex-1 overflow-hidden bg-background p-4">
              {collaborationState?.mode === COLLABORATION_MODES.WORKFLOW ? (
                <SharedPresentation mode="workflow" />
              ) : collaborationState?.mode === COLLABORATION_MODES.WHITEBOARD ? (
                <SharedPresentation mode="whiteboard" />
              ) : collaborationState?.mode === COLLABORATION_MODES.CODE ? (
                <SharedPresentation mode="code" />
              ) : (
                // No presentation mode: Enhanced video grid with layout options
                <ResponsiveVideoGrid />
              )}
            </div>

            <RoomControls
              onRefreshConnection={handleRefreshConnection}
              onReturnToLobby={handleReturnToLobby}
              roomId={roomId}
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
