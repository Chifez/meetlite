import { VideoParticipant } from './VideoParticipant';
import { useRoom } from './RoomContext';

export const VideoGrid = () => {
  const { localStream, peers, peerMediaState, videoEnabled, audioEnabled } =
    useRoom();

  const getGridClass = () => {
    const count = peers.size + 1; // +1 for local user
    return `participants-grid-${count}`;
  };

  return (
    <div className={`video-grid overflow-hidden ${getGridClass()}`}>
      {/* Local video */}
      <VideoParticipant
        stream={localStream}
        mediaState={{ audioEnabled, videoEnabled }}
        isLocal={true}
        isLoading={false}
      />

      {/* Remote videos */}
      {Array.from(peers.values()).map((peer) => {
        const mediaState = peerMediaState.get(peer.id) || {
          audioEnabled: true,
          videoEnabled: true,
        };
        return (
          <VideoParticipant
            key={peer.id}
            stream={peer?.stream || null}
            mediaState={mediaState}
            isLocal={false}
            isLoading={peer.isLoading || false}
          />
        );
      })}
    </div>
  );
};
