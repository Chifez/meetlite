import { useRoom } from '@/contexts/room-context';
import { ParticipantCount } from '@/components/room/participant-count';
import { MediaControls } from '@/components/room/media-control';
import { MoreOptionsMenu } from '@/components/room/more-options-menu';
import { CollaborationMenu } from '@/components/room/collaboration/collaboration-menu';
import { RecordingControls, RecordingIndicator } from '@/components/room/recording-controls';
import { useAuth } from '@/hooks/use-auth';
import { useLayoutManager } from '@/hooks/use-layout-manager';

interface RoomControlsProps {
  onRefreshConnection: () => void;
  onReturnToLobby: () => void;
  // Meeting info props
  meetingTitle?: string;
  roomId?: string;
}

export const RoomControls: React.FC<RoomControlsProps> = ({
  onRefreshConnection,
  onReturnToLobby,
  meetingTitle,
  roomId,
}) => {
  const {
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    screenSharingUser,
    toggleAudio,
    toggleVideo,
    shareScreen,
    leaveMeeting,
    peers,
    collaborationState,
  } = useRoom();
  const { user } = useAuth();
  const { layoutMode, setLayoutMode } = useLayoutManager();

  const isPresenting = collaborationState?.mode !== 'none';
  const canShareScreen = Boolean(
    (!screenSharingUser || (user && screenSharingUser === user.id)) &&
      !isPresenting
  );

  const participantCount = peers.size + 1;

  return (
    <>
      {/* Mobile Participant Count - Sticky on right side */}
      <ParticipantCount count={participantCount} variant="mobile" />
      <CollaborationMenu
        variant="mobile"
        className="fixed bottom-24 left-4 z-10 md:hidden"
      />

      {/* Main Controls Bar */}
      <div className="bg-card border-t border-border py-3.5 relative text-foreground">
        <div className="container max-w-6xl mx-auto px-4">
          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between">
            {/* Left: Meeting Info, Participant Count, Recording and Collaboration Menu */}
            <div className="flex items-center gap-4">
              {/* Meeting Title/ID */}
              {(meetingTitle || roomId) && (
                <div className="text-sm font-medium  truncate max-w-[200px]">
                  {meetingTitle || `Meeting: ${roomId}`}
                </div>
              )}
              <ParticipantCount count={participantCount} />
              <RecordingControls roomId={roomId} variant="default" />
              <CollaborationMenu />
            </div>

            {/* Center: Main Controls */}
            <MediaControls
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              isScreenSharing={isScreenSharing}
              canShareScreen={canShareScreen}
              onToggleAudio={toggleAudio}
              onToggleVideo={toggleVideo}
              onShareScreen={shareScreen}
              onLeaveMeeting={leaveMeeting}
            />

            {/* Right: More Options */}
            <MoreOptionsMenu
              onRefreshConnection={onRefreshConnection}
              onReturnToLobby={onReturnToLobby}
              currentLayoutMode={layoutMode}
              onLayoutModeChange={setLayoutMode}
              participantCount={participantCount}
              isPresenting={isPresenting}
            />
          </div>

          {/* Mobile Layout - Centered Controls */}
          <div className="flex md:hidden items-center justify-between px-4">
            {/* Left: Meeting Info */}
            {(meetingTitle || roomId) && (
              <div className="text-xs font-medium  truncate max-w-[120px]">
                {meetingTitle || roomId}
              </div>
            )}

            {/* Center: Main Controls */}
            <MediaControls
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              isScreenSharing={isScreenSharing}
              canShareScreen={canShareScreen}
              onToggleAudio={toggleAudio}
              onToggleVideo={toggleVideo}
              onShareScreen={shareScreen}
              onLeaveMeeting={leaveMeeting}
              showScreenShare={false}
            />

            {/* Right: Spacer or More Options */}
            <div className="w-[120px] flex justify-end">
              <MoreOptionsMenu
                onRefreshConnection={onRefreshConnection}
                onReturnToLobby={onReturnToLobby}
                currentLayoutMode={layoutMode}
                onLayoutModeChange={setLayoutMode}
                participantCount={participantCount}
                isPresenting={isPresenting}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
