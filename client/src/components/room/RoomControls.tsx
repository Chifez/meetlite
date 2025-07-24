import { useRoom } from '@/contexts/RoomContext';
import { ParticipantCount } from './ParticipantCount';
import { MediaControls } from './MediaControls';
import { MoreOptionsMenu } from './MoreOptionsMenu';
import { CollaborationMenu } from './collaboration/CollaborationMenu';

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
    socket,
    peers,
  } = useRoom();

  const canShareScreen =
    !screenSharingUser || (socket && screenSharingUser === socket.id);

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
              canShareScreen={canShareScreen as boolean}
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
              canShareScreen={canShareScreen as boolean}
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
