import { SharedScreen } from './SharedScreen';
import { MobileVideoLayout } from './layouts/MobileVideoLayout';
import { DesktopVideoLayout } from './layouts/DesktopVideoLayout';
import { useRoom } from '@/contexts/RoomContext';

export const VideoGrid = () => {
  const {
    localStream,
    peers,
    screenPeers,
    peerMediaState,
    videoEnabled,
    audioEnabled,
    screenStream,
    screenSharingUser,
  } = useRoom();

  // Get the screen sharing stream from peers if we're not the one sharing
  const sharedScreenStream =
    screenStream ||
    (screenSharingUser &&
      Array.from(screenPeers.values()).find((p) => p.id === screenSharingUser)
        ?.stream) ||
    null;

  // Calculate participant count
  const participantCount = peers.size + 1; // +1 for local user

  // Create array of all participants (local + peers)
  const allParticipants = [
    {
      id: 'local',
      stream: localStream,
      mediaState: { audioEnabled, videoEnabled },
      isLocal: true,
      isLoading: false,
    },
    ...Array.from(peers.entries()).map(([peerId, peer]) => ({
      id: peerId,
      stream: peer.stream || null,
      mediaState: peerMediaState.get(peer.id) || {
        audioEnabled: true,
        videoEnabled: true,
      },
      isLocal: false,
      isLoading: peer.isLoading || false,
    })),
  ];

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* Mobile: Keep horizontal split for screen sharing */}
      {sharedScreenStream && (
        <div className="md:hidden w-full h-1/2 mb-2 flex-shrink-0">
          <SharedScreen stream={sharedScreenStream} />
        </div>
      )}

      {/* Layout Container */}
      <div
        className={`flex-1 overflow-hidden ${
          sharedScreenStream ? 'md:flex md:flex-row' : 'flex flex-col'
        } ${sharedScreenStream ? 'md:h-full h-1/2' : 'h-full'}`}
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
