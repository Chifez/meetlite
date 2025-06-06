import { VideoParticipant } from '../VideoParticipant';
import { Participant } from '../types';

interface DesktopVideoLayoutProps {
  participants: Participant[];
  hasSharedScreen: boolean;
  participantCount: number;
}

export const DesktopVideoLayout = ({
  participants,
  hasSharedScreen,
  participantCount,
}: DesktopVideoLayoutProps) => {
  return (
    <div className="hidden md:flex w-full h-full items-center justify-center overflow-hidden">
      {/* When Screen Sharing: Vertical Stack in Sidebar */}
      {hasSharedScreen ? (
        <div className="w-full h-full overflow-y-auto scrollbar-hide">
          <div className="flex flex-col items-center gap-2 p-2 min-h-full">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="relative w-full aspect-[4/3] max-w-[250px] flex-shrink-0"
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
      ) : (
        /* No Screen Sharing: Original Layout */
        <>
          {/* Single Participant - Full Screen */}
          {participantCount === 1 && (
            <div className="w-full h-full p-4">
              <div className="w-full h-full">
                <VideoParticipant
                  stream={participants[0].stream}
                  mediaState={participants[0].mediaState}
                  isLocal={participants[0].isLocal}
                  isLoading={participants[0].isLoading}
                />
              </div>
            </div>
          )}

          {/* Two Participants - Side by Side */}
          {participantCount === 2 && (
            <div className="w-full h-full p-4 flex items-center justify-center gap-4">
              {participants.map((participant) => (
                <div key={participant.id} className="flex-1 h-full">
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
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="relative w-full h-full min-w-[200px] min-h-[150px] max-w-sm max-h-80"
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
        </>
      )}
    </div>
  );
};
