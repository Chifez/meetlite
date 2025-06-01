import { VideoParticipant } from './VideoParticipant';
import { SharedScreen } from './SharedScreen';
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

  // Get dynamic sizing based on participant count and available space
  const getVideoSize = () => {
    // Mobile: Single column layout
    const mobileSize = {
      width: '90vw',
      height: sharedScreenStream ? '30vh' : '50vh', // Smaller when screen sharing
      maxWidth: '400px',
      maxHeight: '300px',
    };

    // Desktop: Google Meet-style sizing
    if (participantCount === 1) {
      // Single participant - take full available space or fixed ratio when screen sharing
      if (sharedScreenStream) {
        return {
          mobile: mobileSize,
          desktop: {
            width: '400px',
            height: '300px', // 4:3 ratio
            useFixedRatio: true,
          },
          layout: { cols: 1, rows: 1 },
        };
      }
      return {
        mobile: mobileSize,
        desktop: {
          width: '100%',
          height: '100%',
          useFullScreen: true,
        },
        layout: { cols: 1, rows: 1 },
      };
    } else if (participantCount === 2) {
      // Two participants - side by side, fixed ratio when screen sharing
      if (sharedScreenStream) {
        return {
          mobile: mobileSize,
          desktop: {
            width: '300px',
            height: '225px', // 4:3 ratio
            useFixedRatio: true,
          },
          layout: { cols: 2, rows: 1 },
        };
      }
      return {
        mobile: mobileSize,
        desktop: {
          width: 'calc(50% - 0.5rem)', // Half width minus gap
          height: '100%',
          useSideBySide: true,
        },
        layout: { cols: 2, rows: 1 },
      };
    } else {
      // 3+ participants - always use fixed minimum sizes like Google Meet
      return {
        mobile: mobileSize,
        desktop: {
          width: sharedScreenStream ? '240px' : '320px', // Smaller when screen sharing
          height: sharedScreenStream ? '180px' : '240px', // 4:3 ratio maintained
          minWidth: '200px',
          minHeight: '150px',
          maxWidth: '400px',
          maxHeight: '300px',
          useFlexWrap: true,
        },
        layout: { cols: 3, rows: Math.ceil(participantCount / 3) },
      };
    }
  };

  const { mobile: mobileSize, desktop: desktopSize } = getVideoSize();

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
      {/* Shared Screen - Takes up top portion when present */}
      {sharedScreenStream && (
        <div className="w-full h-1/2 mb-2 flex-shrink-0">
          <SharedScreen stream={sharedScreenStream} />
        </div>
      )}

      {/* Participants Container - Centered flexbox layout */}
      <div
        className={`flex-1 flex items-center justify-center overflow-hidden ${
          sharedScreenStream ? 'h-1/2' : 'h-full'
        }`}
      >
        {/* Mobile Layout - Single Column */}
        <div className="md:hidden w-full h-full overflow-y-auto scrollbar-hide">
          <div className="flex flex-col items-center justify-center gap-4 py-4 px-2 min-h-full">
            {allParticipants.map((participant) => (
              <div
                key={participant.id}
                className="relative flex-shrink-0"
                style={{
                  width: mobileSize.width,
                  height: mobileSize.height,
                  maxWidth: mobileSize.maxWidth,
                  maxHeight: mobileSize.maxHeight,
                }}
              >
                <VideoParticipant
                  stream={participant.stream}
                  mediaState={participant.mediaState}
                  isLocal={participant.isLocal}
                  isLoading={participant.isLoading}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Layout - Google Meet Style */}
        <div className="hidden md:flex w-full h-full items-center justify-center overflow-hidden">
          {/* Single Participant - Full Screen or Fixed Ratio */}
          {participantCount === 1 && (
            <div className="w-full h-full p-4 flex items-center justify-center">
              <div
                className={
                  sharedScreenStream ? 'flex-shrink-0' : 'w-full h-full'
                }
                style={
                  sharedScreenStream
                    ? {
                        width: desktopSize.width,
                        height: desktopSize.height,
                      }
                    : {}
                }
              >
                <VideoParticipant
                  stream={allParticipants[0].stream}
                  mediaState={allParticipants[0].mediaState}
                  isLocal={allParticipants[0].isLocal}
                  isLoading={allParticipants[0].isLoading}
                />
              </div>
            </div>
          )}

          {/* Two Participants - Side by Side or Fixed Ratio */}
          {participantCount === 2 && (
            <div className="w-full h-full p-4 flex items-center justify-center gap-4">
              {allParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className={
                    sharedScreenStream ? 'flex-shrink-0' : 'flex-1 h-full'
                  }
                  style={
                    sharedScreenStream
                      ? {
                          width: desktopSize.width,
                          height: desktopSize.height,
                        }
                      : {
                          maxWidth: 'calc(50% - 0.5rem)',
                        }
                  }
                >
                  <VideoParticipant
                    stream={participant.stream}
                    mediaState={participant.mediaState}
                    isLocal={participant.isLocal}
                    isLoading={participant.isLoading}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Three or More Participants - Fixed Size with Flex Wrap */}
          {participantCount >= 3 && (
            <div className="w-full h-full overflow-y-auto scrollbar-hide">
              <div className="flex flex-wrap items-center justify-center gap-4 p-4 min-h-full">
                {allParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="relative flex-shrink-0"
                    style={{
                      width: desktopSize.width,
                      height: desktopSize.height,
                      minWidth: desktopSize.minWidth,
                      minHeight: desktopSize.minHeight,
                      maxWidth: desktopSize.maxWidth,
                      maxHeight: desktopSize.maxHeight,
                    }}
                  >
                    <VideoParticipant
                      stream={participant.stream}
                      mediaState={participant.mediaState}
                      isLocal={participant.isLocal}
                      isLoading={participant.isLoading}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
