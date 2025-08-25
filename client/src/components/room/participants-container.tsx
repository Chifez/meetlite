import { MobileVideoLayout } from './layouts/mobile-video-layout';
import { DesktopVideoLayout } from './layouts/desktop-video-layout';
import { useRoom } from '@/contexts/room-context';

export const ParticipantsContainer = () => {
  const {
    localStream,
    peers,
    peerMediaState,
    videoEnabled,
    audioEnabled,
    getParticipantEmail,
  } = useRoom();

  // Calculate participant count
  const participantCount = peers.size + 1; // +1 for local user

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
    <div className="w-full h-full overflow-hidden">
      {/* Mobile Layout */}
      <MobileVideoLayout
        participants={allParticipants}
        hasSharedScreen={true} // Force horizontal layout
      />

      {/* Desktop Layout */}
      <DesktopVideoLayout
        participants={allParticipants}
        hasSharedScreen={true} // Force vertical stack
        participantCount={participantCount}
      />
    </div>
  );
};
