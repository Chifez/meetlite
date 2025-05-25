import { VideoOff, Users, MicOff } from 'lucide-react';
import { VideoParticipantProps } from './types';

export const VideoParticipant = ({
  stream,
  mediaState,
  isLocal,
}: VideoParticipantProps) => {
  return (
    <div className="video-container">
      {stream ? (
        <>
          <video
            autoPlay
            playsInline
            muted={isLocal}
            ref={(el) => {
              if (el && stream) {
                el.srcObject = stream;
              }
            }}
            className={`${!mediaState.videoEnabled ? 'hidden' : ''}`}
          />
          {!mediaState.videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <VideoOff className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Users className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
      <div className="video-label">
        {isLocal ? 'You' : 'Participant'}{' '}
        {!mediaState.audioEnabled && <MicOff className="h-4 w-4 inline ml-1" />}
      </div>
    </div>
  );
};
