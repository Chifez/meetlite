import { VideoParticipant } from '../VideoParticipant';
import { Participant } from '../types';

interface MobileVideoLayoutProps {
  participants: Participant[];
  hasSharedScreen: boolean;
}

export const MobileVideoLayout = ({
  participants,
  hasSharedScreen,
}: MobileVideoLayoutProps) => {
  return (
    <div className="md:hidden w-full h-full overflow-y-auto scrollbar-hide">
      {hasSharedScreen ? (
        // Screen sharing: Horizontal scrollable layout
        <div className="flex flex-row items-center gap-2 py-2 px-2 min-h-full overflow-x-auto scrollbar-hide">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="relative flex-shrink-0 w-[150px] h-[120px]"
            >
              <VideoParticipant
                stream={participant.stream}
                mediaState={participant.mediaState}
                isLocal={participant.isLocal}
                isLoading={participant.isLoading}
                userEmail={participant.userEmail}
                userName={participant.userName}
              />
            </div>
          ))}
        </div>
      ) : (
        // No screen sharing: Vertical layout (original)
        <div className="flex flex-col items-center justify-center gap-4 py-4 px-2 min-h-full">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="relative flex-shrink-0 w-[90vw] max-w-sm h-[50vh] max-h-80"
            >
              <VideoParticipant
                stream={participant.stream}
                mediaState={participant.mediaState}
                isLocal={participant.isLocal}
                isLoading={participant.isLoading}
                userEmail={participant.userEmail}
                userName={participant.userName}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
