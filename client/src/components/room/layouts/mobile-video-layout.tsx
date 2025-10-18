import { EnhancedVideoParticipant } from '@/components/room/enhanced-video-participant';
import { useState, useEffect, useMemo } from 'react';
import { useRoom } from '@/contexts/room-context';
import { Users } from 'lucide-react';

export const MobileVideoLayout = () => {
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
    if (hasSharedScreen) {
      // When presenting: show participants horizontally below presentation screen
      return (
        <div className="w-full h-full flex flex-col">
          {/* Participants horizontal strip at bottom */}
          <div className="flex-shrink-0 h-20 flex items-center gap-2 px-2 pb-2 overflow-x-auto scrollbar-hide">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="relative flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg"
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
            {participants.length > 5 && (
              <div className="relative flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg bg-gray-800 flex items-center justify-center">
                <div className="text-center text-white">
                  <span className="text-xs font-medium">
                    +{participants.length - 5}
                  </span>
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
              <div key={participant.id} className="flex-1 aspect-[16/9]">
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
              <div key={participant.id} className="flex-1 aspect-[16/9]">
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

    // 3+ participants: main speaker + participants row
    // Randomly select main speaker (not the current user) or use manually selected
    const getMainSpeaker = () => {
      // If manually selected, use that
      if (activeSpeaker) {
        return participants.find((p) => p.id === activeSpeaker);
      }

      // Randomly select someone other than the current user
      const otherParticipants = participants.filter((p) => !p.isLocal);

      if (otherParticipants.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * otherParticipants.length
        );
        return otherParticipants[randomIndex];
      }

      // Fallback: use first participant
      return participants[0];
    };

    const mainSpeaker = getMainSpeaker();
    if (!mainSpeaker) return null; // Safety check

    const otherParticipants = participants.filter(
      (p) => p.id !== mainSpeaker.id
    );

    // Show max 3 participants in the row, rest as +X more
    const maxVisibleParticipants = 3;
    const visibleParticipants = otherParticipants.slice(
      0,
      maxVisibleParticipants
    );
    const remainingCount = otherParticipants.length - maxVisibleParticipants;

    return (
      <div className="w-full h-full flex flex-col">
        {/* Main Speaker - Full height */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="relative w-full aspect-[16/9]">
            <EnhancedVideoParticipant
              stream={mainSpeaker.stream}
              mediaState={mainSpeaker.mediaState}
              isLocal={mainSpeaker.isLocal}
              isLoading={mainSpeaker.isLoading}
              userEmail={mainSpeaker.userEmail}
              userName={mainSpeaker.userName}
              layoutMode="speaker"
              isMainSpeaker={true}
            />
          </div>
        </div>

        {/* Participants Row - Fixed height at bottom */}
        <div className="flex-shrink-0 flex items-center justify-start gap-3 px-4 pb-4 h-20">
          {visibleParticipants.map((participant) => (
            <div
              key={participant.id}
              className="relative flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg"
              onClick={() => setActiveSpeaker(participant.id)}
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

          {/* Show +X more indicator if there are remaining participants */}
          {remainingCount > 0 && (
            <div className="relative flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg bg-gray-800 flex items-center justify-center">
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
