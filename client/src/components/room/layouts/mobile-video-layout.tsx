import { EnhancedVideoParticipant } from '@/components/room/enhanced-video-participant';
import { useState, useEffect, useMemo } from 'react';
import { useRoom } from '@/contexts/room-context';
import { Users } from 'lucide-react';

interface MobileVideoLayoutProps {
  isPresenting?: boolean;
}

export const MobileVideoLayout = ({
  isPresenting = false,
}: MobileVideoLayoutProps) => {
  const {
    localStream,
    peers,
    peerMediaState,
    videoEnabled,
    audioEnabled,
    getParticipantEmail,
    getParticipantDisplayName,
    screenStream,
    screenSharingUser,
    screenPeers,
  } = useRoom();

  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);

  // Get the screen sharing stream from peers if we're not the one sharing
  const sharedScreenStream =
    screenStream ||
    (screenSharingUser &&
      Array.from(screenPeers.values()).find((p) => p.id === screenSharingUser)
        ?.stream) ||
    null;

  const hasSharedScreen = !!sharedScreenStream;

  // Create array of all participants (local + peers) with user info
  const participants = useMemo(
    () => [
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
        const participantDisplayName = getParticipantDisplayName(peer.id);

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
          userName: participantDisplayName || participantEmail || 'Participant',
        };
      }),
    ],
    [
      localStream,
      audioEnabled,
      videoEnabled,
      peers,
      peerMediaState,
      getParticipantEmail,
      getParticipantDisplayName,
    ]
  );

  // Detect landscape mode
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Google Meet-style mobile behavior
  const renderMobileLayout = () => {
    if (hasSharedScreen || isPresenting) {
      // When presenting (screen sharing or collaboration): show participants in 2 rows of 3 grids
      const maxVisibleParticipants = 5; // Show 5 participants + 1 "+X more" = 6 total slots
      const visibleParticipants = participants.slice(0, maxVisibleParticipants);
      const remainingCount = participants.length - maxVisibleParticipants;

      return (
        <div className="w-full h-full flex flex-col">
          {/* Participants grid: 2 rows of 3 */}
          <div className="flex-shrink-0 h-32 grid grid-cols-3 grid-rows-2 gap-2 px-2 pb-2">
            {visibleParticipants.map((participant) => (
              <div
                key={participant.id}
                className="relative aspect-[16/9] rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg"
              >
                <EnhancedVideoParticipant
                  stream={participant.stream}
                  mediaState={participant.mediaState}
                  isLocal={participant.isLocal}
                  isLoading={participant.isLoading}
                  userEmail={participant.userEmail}
                  userName={participant.userName}
                  layoutMode="presentation"
                />
              </div>
            ))}

            {/* Show more participants indicator */}
            {remainingCount > 0 && (
              <div className="relative aspect-[16/9] rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg bg-gray-800 flex items-center justify-center">
                <div className="text-center text-white">
                  <Users className="h-4 w-4 mx-auto mb-1" />
                  <span className="text-xs font-medium">+{remainingCount}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (participants.length === 1) {
      // Single participant: full screen self-view
      return (
        <div className="w-full h-full flex items-center justify-center p-2">
          <div className="relative w-full h-[60%]">
            <EnhancedVideoParticipant
              stream={participants[0].stream}
              mediaState={participants[0].mediaState}
              isLocal={participants[0].isLocal}
              isLoading={participants[0].isLoading}
              userEmail={participants[0].userEmail}
              userName={participants[0].userName}
              layoutMode="grid"
            />
          </div>
        </div>
      );
    }

    if (participants.length === 2) {
      // Two participants: side by side in landscape, stacked in portrait
      if (isLandscape) {
        return (
          <div className="w-full h-full flex flex-row gap-2 p-2">
            {participants.map((participant) => (
              <div key={participant.id} className="flex-1 min-w-0 min-h-0">
                <EnhancedVideoParticipant
                  stream={participant.stream}
                  mediaState={participant.mediaState}
                  isLocal={participant.isLocal}
                  isLoading={participant.isLoading}
                  userEmail={participant.userEmail}
                  userName={participant.userName}
                  layoutMode="presentation"
                />
              </div>
            ))}
          </div>
        );
      } else {
        return (
          <div className="w-full h-full flex flex-col gap-2 p-2">
            {participants.map((participant) => (
              <div key={participant.id} className="flex-1 min-w-0 min-h-0">
                <EnhancedVideoParticipant
                  stream={participant.stream}
                  mediaState={participant.mediaState}
                  isLocal={participant.isLocal}
                  isLoading={participant.isLoading}
                  userEmail={participant.userEmail}
                  userName={participant.userName}
                  layoutMode="presentation"
                />
              </div>
            ))}
          </div>
        );
      }
    }

    // 3+ participants: exactly 2 rows of 3 grids (5 participants + 1 "+X more")
    const maxVisibleParticipants = 5; // Show 5 participants + 1 "+X more" = 6 total slots
    const visibleParticipants = participants.slice(0, maxVisibleParticipants);
    const remainingCount = participants.length - maxVisibleParticipants;

    return (
      <div className="w-full h-full flex flex-col">
        {/* Participants grid: 2 rows of 3 */}
        <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-2 p-2">
          {visibleParticipants.map((participant) => (
            <div
              key={participant.id}
              className="relative aspect-[16/9] rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg"
              onClick={() => setActiveSpeaker(participant.id)}
            >
              <EnhancedVideoParticipant
                stream={participant.stream}
                mediaState={participant.mediaState}
                isLocal={participant.isLocal}
                isLoading={participant.isLoading}
                userEmail={participant.userEmail}
                userName={participant.userName}
                layoutMode="grid"
                isMainSpeaker={activeSpeaker === participant.id}
              />
            </div>
          ))}

          {/* Show +X more indicator if there are remaining participants */}
          {remainingCount > 0 && (
            <div className="relative aspect-[16/9] rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg bg-gray-800 flex items-center justify-center">
              <div className="text-center text-white">
                <Users className="h-4 w-4 mx-auto mb-1" />
                <span className="text-xs font-medium">+{remainingCount}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="md:hidden w-full h-full overflow-hidden">
      {renderMobileLayout()}
    </div>
  );
};
