import { MobileVideoLayout } from './layouts/MobileVideoLayout';
import { DesktopVideoLayout } from './layouts/DesktopVideoLayout';
import { SharedScreen } from './SharedScreen';
import { useRoom } from '@/contexts/RoomContext';

export const VideoGrid = () => {
  const {
    localStream,
    peers,
    peerMediaState,
    videoEnabled,
    audioEnabled,
    getParticipantEmail,
    screenStream,
    screenSharingUser,
    screenPeers,
  } = useRoom();

  // Calculate participant count
  const participantCount = peers.size + 1; // +1 for local user

  // Get the screen sharing stream from peers if we're not the one sharing
  const sharedScreenStream =
    screenStream ||
    (screenSharingUser &&
      Array.from(screenPeers.values()).find((p) => p.id === screenSharingUser)
        ?.stream) ||
    null;

  // Create array of all participants (local + peers) with user info
  const allParticipants = [
    {
      id: 'local',
      stream: localStream,
      mediaState: { audioEnabled, videoEnabled },
      isLocal: true,
      isLoading: false,
      userEmail: undefined,
      userName: 'You',
    },
    ...Array.from(peers.entries()).map(([peerId, peer]) => {
      const participantEmail = getParticipantEmail(peer.id);

      return {
        id: peerId,
        stream: peer.stream || null,
        mediaState: peerMediaState.get(peer.id) || {
          audioEnabled: true,
          videoEnabled: true,
        },
        isLocal: false,
        isLoading: peer.isLoading || false,
        userEmail: participantEmail,
        userName: participantEmail || 'Participant',
      };
    }),
  ];

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* Mobile: Screen sharing takes 65% height */}
      {sharedScreenStream && (
        <div className="md:hidden w-full h-[65%] mb-2 flex-shrink-0">
          <SharedScreen stream={sharedScreenStream} />
        </div>
      )}

      {/* Layout Container */}
      <div
        className={`flex-1 overflow-hidden ${
          sharedScreenStream ? 'md:flex md:flex-row' : 'flex flex-col'
        } ${sharedScreenStream ? 'md:h-full h-[35%]' : 'h-full'}`}
      >
        {/* Desktop: Shared Screen */}
        {sharedScreenStream && (
          <div className="hidden md:block w-[68%] h-full flex-shrink-0 pr-2">
            <SharedScreen stream={sharedScreenStream} />
          </div>
        )}

        {/* Participants Container */}
        <div
          className={`flex-1 overflow-hidden ${
            sharedScreenStream ? 'md:w-[32%] h-full' : 'w-full h-full'
          }`}
        >
          {/* Mobile Layout */}
          <MobileVideoLayout
            participants={allParticipants}
            hasSharedScreen={!!sharedScreenStream}
          />

          {/* Desktop Layout */}
          <DesktopVideoLayout
            participants={allParticipants}
            hasSharedScreen={!!sharedScreenStream}
            participantCount={participantCount}
          />
        </div>
      </div>
    </div>
  );
};
