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

      {/* Participants Container */}
      <div
        className={`flex-1 overflow-hidden ${
          sharedScreenStream ? 'h-1/2' : 'h-full'
        }`}
      >
        {/* Mobile Layout - Single Column */}
        <div className="md:hidden w-full h-full overflow-y-auto scrollbar-hide">
          <div className="flex flex-col items-center justify-center gap-4 py-4 px-2 min-h-full">
            {allParticipants.map((participant) => (
              <div
                key={participant.id}
                className={`relative flex-shrink-0 w-[90vw] max-w-sm ${
                  sharedScreenStream ? 'h-[30vh]' : 'h-[50vh]'
                } max-h-80`}
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

        {/* Desktop Layout */}
        <div className="hidden md:flex w-full h-full items-center justify-center overflow-hidden">
          {/* Single Participant - Full Screen */}
          {participantCount === 1 && (
            <div className="w-full h-full p-4">
              <div
                className={
                  sharedScreenStream ? 'w-96 h-72 mx-auto' : 'w-full h-full'
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

          {/* Two Participants - Side by Side */}
          {participantCount === 2 && (
            <div className="w-full h-full p-4 flex items-center justify-center gap-4">
              {allParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className={sharedScreenStream ? 'w-72 h-56' : 'flex-1 h-full'}
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

          {/* Three or More Participants - Grid Layout */}
          {participantCount >= 3 && (
            <div className="w-full h-full overflow-y-auto scrollbar-hide">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 p-4 place-items-center min-h-full min-w-full">
                {allParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className={`relative ${
                      sharedScreenStream
                        ? 'w-60 h-44' // 240px x 176px (close to 4:3)
                        : 'w-full h-full' // 320px x 240px (4:3)
                    } min-w-[200px] min-h-[150px] max-w-sm max-h-80`}
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
