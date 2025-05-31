import { VideoParticipant } from './VideoParticipant';
import { SharedScreen } from './SharedScreen';
import { useRoom } from '@/contexts/RoomContext';
import { PeerConnection } from './types';

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
      Array.from(screenPeers.values()).find(
        (p: PeerConnection) => p.id === screenSharingUser
      )?.stream) ||
    null;

  // Calculate grid layout based on participant count and screen size
  const participantCount = peers.size + 1; // +1 for local user

  const getGridLayout = () => {
    // Mobile layout (single column)
    const mobileLayout = {
      cols: 1, // Always single column on mobile
      rows: participantCount,
    };

    // Desktop layout (max 3 per row)
    const desktopLayout = {
      cols: participantCount === 1 ? 1 : Math.min(3, participantCount),
      rows: Math.ceil(participantCount / 3),
    };

    return { mobile: mobileLayout, desktop: desktopLayout };
  };

  const getParticipantSize = () => {
    // Mobile sizing - single column, responsive width
    const mobileSize = {
      width: '90vw',
      height: '67.5vw', // Maintaining 4:3 aspect ratio (90vw * 3/4)
      maxWidth: '400px',
      maxHeight: '300px',
    };

    // Desktop sizing - calculate based on available space and grid (1:1 ratio)
    const { desktop } = getGridLayout();
    const availableWidth = 90; // 90vw
    const containerHeight = sharedScreenStream ? 45 : 80; // 45vh or 80vh

    // Calculate width per column (with gap consideration)
    const gapSpace = (desktop.cols - 1) * 1; // 1vw per gap
    const widthPerColumn = (availableWidth - gapSpace) / desktop.cols;

    // Use 1:1 aspect ratio for desktop (square boxes)
    const calculatedHeight = widthPerColumn; // 1:1 aspect ratio

    // Ensure we don't exceed container height
    const maxHeightPerRow =
      (containerHeight - (desktop.rows - 1) * 2) / desktop.rows; // 2vh per gap
    const finalHeight = Math.min(calculatedHeight, maxHeightPerRow);
    const finalWidth = finalHeight; // Maintain 1:1 aspect ratio

    const desktopSize = {
      width: `${finalWidth}vw`,
      height: `${finalHeight}vh`,
      maxWidth: '400px',
      maxHeight: '400px',
    };

    return { mobile: mobileSize, desktop: desktopSize };
  };

  console.log('VideoGrid screen sharing state:', {
    isLocalSharing: !!screenStream,
    screenSharingUser,
    peerScreenStreams: Array.from(screenPeers.entries()).map(([id, peer]) => ({
      id,
      hasStream: !!peer.stream,
      tracks: peer.stream?.getTracks().map((track) => ({
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
      })),
    })),
    finalStream: sharedScreenStream
      ? {
          tracks: sharedScreenStream.getTracks().map((track) => ({
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
          })),
        }
      : null,
  });

  const { mobile, desktop } = getGridLayout();
  const { mobile: mobileSize, desktop: desktopSize } = getParticipantSize();

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto scrollbar-hide">
      {/* Shared Screen - Takes up half height when present */}
      {sharedScreenStream && (
        <div className="w-full h-1/2 mb-2 flex-shrink-0">
          <SharedScreen stream={sharedScreenStream} />
        </div>
      )}

      {/* Participants Grid - Centered with fluid sizing */}
      <div
        className={`flex-1 flex items-center justify-center ${
          sharedScreenStream ? 'h-1/2' : 'h-full'
        }`}
      >
        {/* Mobile Grid */}
        <div
          className="md:hidden w-full h-full flex items-start justify-center"
          style={{
            maxWidth: '95vw',
            maxHeight: sharedScreenStream ? '45vh' : '80vh',
          }}
        >
          <div
            className="flex flex-col items-center gap-2 pt-4 pb-8 px-2 overflow-y-auto scrollbar-hide"
            style={{
              width: '100%',
              maxHeight: '100%',
            }}
          >
            <div
              className="relative flex-shrink-0"
              style={{
                width: mobileSize.width,
                height: mobileSize.height,
                maxWidth: mobileSize.maxWidth,
                maxHeight: mobileSize.maxHeight,
              }}
            >
              <VideoParticipant
                stream={localStream}
                mediaState={{ audioEnabled, videoEnabled }}
                isLocal={true}
              />
            </div>

            {Array.from(peers.entries()).map(([peerId, peer]) => (
              <div
                key={peerId}
                className="relative flex-shrink-0"
                style={{
                  width: mobileSize.width,
                  height: mobileSize.height,
                  maxWidth: mobileSize.maxWidth,
                  maxHeight: mobileSize.maxHeight,
                }}
              >
                <VideoParticipant
                  stream={peer.stream || null}
                  mediaState={
                    peerMediaState.get(peer.id) || {
                      audioEnabled: true,
                      videoEnabled: true,
                    }
                  }
                  isLocal={false}
                  isLoading={peer.isLoading || false}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Grid */}
        <div
          className="hidden md:block w-full h-full"
          style={{
            maxWidth: '95vw',
            maxHeight: sharedScreenStream ? '45vh' : '80vh',
          }}
        >
          <div
            className="grid gap-2 place-items-center place-content-center p-2 min-h-full overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${desktop.cols}, 1fr)`,
            }}
          >
            <div
              className="relative"
              style={{
                width: desktopSize.width,
                height: desktopSize.height,
                maxWidth: desktopSize.maxWidth,
                maxHeight: desktopSize.maxHeight,
              }}
            >
              <VideoParticipant
                stream={localStream}
                mediaState={{ audioEnabled, videoEnabled }}
                isLocal={true}
              />
            </div>

            {Array.from(peers.entries()).map(([peerId, peer]) => (
              <div
                key={peerId}
                className="relative"
                style={{
                  width: desktopSize.width,
                  height: desktopSize.height,
                  maxWidth: desktopSize.maxWidth,
                  maxHeight: desktopSize.maxHeight,
                }}
              >
                <VideoParticipant
                  stream={peer.stream || null}
                  mediaState={
                    peerMediaState.get(peer.id) || {
                      audioEnabled: true,
                      videoEnabled: true,
                    }
                  }
                  isLocal={false}
                  isLoading={peer.isLoading || false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
