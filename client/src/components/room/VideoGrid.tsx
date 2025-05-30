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

  const getGridClass = () => {
    const count = peers.size + 1; // +1 for local user
    return `participants-grid-${count}`;
  };

  // Get the screen sharing stream from peers if we're not the one sharing
  const sharedScreenStream =
    screenStream ||
    (screenSharingUser &&
      Array.from(screenPeers.values()).find(
        (p: PeerConnection) => p.id === screenSharingUser
      )?.stream) ||
    null;

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

  return (
    <div className="overflow-scroll flex flex-col w-full h-full gap-4">
      {/* Shared Screen */}
      {sharedScreenStream && <SharedScreen stream={sharedScreenStream} />}

      {/* Participants Grid */}
      <div
        className={`grid gap-4 w-full ${
          sharedScreenStream ? 'h-[45vh]' : 'h-[95vh]'
        } ${getGridClass()}`}
      >
        <VideoParticipant
          stream={localStream}
          mediaState={{ audioEnabled, videoEnabled }}
          isLocal={true}
        />
        {Array.from(peers.entries()).map(([peerId, peer]) => (
          <VideoParticipant
            key={peerId}
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
        ))}
      </div>
    </div>
  );
};
