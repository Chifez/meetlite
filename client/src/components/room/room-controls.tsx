import { useRoom } from '@/contexts/room-context';
import { ParticipantCount } from './participants';
import { MediaControls } from './media-control';
import { MoreOptionsMenu } from './more-options-menu';
import { CollaborationMenu } from './collaboration/collaboration-menu';
import { useAuth } from '@/hooks/useAuth';

interface RoomControlsProps {
  onRefreshConnection: () => void;
  onReturnToLobby: () => void;
}

export const RoomControls: React.FC<RoomControlsProps> = ({
  onRefreshConnection,
  onReturnToLobby,
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
      <div className="bg-background border-t py-4 relative">
        <div className="container max-w-6xl mx-auto px-4">
          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between">
            {/* Left: Participant Count and Collaboration Menu */}
            <div className="flex items-center gap-4">
              <ParticipantCount count={participantCount} />
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
            />
          </div>

          {/* Mobile Layout - Centered Controls */}
          <div className="flex md:hidden items-center justify-center">
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
          </div>
        </div>
      </div>
    </>
  );
};
