import { BaseLayoutProps } from './base-layout-props';
import { EnhancedVideoParticipant } from '@/components/room/enhanced-video-participant';
import { Users } from 'lucide-react';

export const SpeakerLayout = ({
  participants,
  layoutConfig,
  layoutMode,
  layoutClasses,
  screenSize,
  onPinParticipant,
}: BaseLayoutProps) => {
  const [mainSpeaker, ...otherSpeakers] = participants;

  if (!mainSpeaker) return null;

  return (
    <div
      className={`flex ${
        screenSize === 'small' ? 'flex-col' : 'flex-row'
      } h-full ${layoutClasses.container}`}
    >
      {/* Main Speaker */}
      <div
        className={`${screenSize === 'small' ? 'flex-1 mb-4' : 'flex-1 mr-4'}`}
      >
        <div className={layoutClasses.mainSpeaker}>
          <EnhancedVideoParticipant
            stream={mainSpeaker.stream}
            mediaState={mainSpeaker.mediaState}
            isLocal={mainSpeaker.isLocal}
            isLoading={mainSpeaker.isLoading}
            userEmail={mainSpeaker.userEmail}
            userName={mainSpeaker.userName}
            layoutMode={layoutMode}
            isMainSpeaker={true}
          />
        </div>
      </div>

      {/* Secondary Speakers Thumbnail Strip */}
      <div
        className={`${screenSize === 'small' ? 'h-32' : 'w-64'} ${
          layoutClasses.grid
        }`}
      >
        {otherSpeakers
          .slice(0, layoutConfig.maxVisibleParticipants - 1)
          .map((participant) => (
            <div
              key={participant.id}
              className={layoutClasses.secondarySpeaker}
              onClick={() => onPinParticipant(participant.id)}
            >
              <EnhancedVideoParticipant
                stream={participant.stream}
                mediaState={participant.mediaState}
                isLocal={participant.isLocal}
                isLoading={participant.isLoading}
                userEmail={participant.userEmail}
                userName={participant.userName}
                layoutMode={layoutMode}
              />
            </div>
          ))}

        {/* Show more participants indicator */}
        {otherSpeakers.length > layoutConfig.maxVisibleParticipants - 1 && (
          <div
            className={`${layoutClasses.secondarySpeaker} flex items-center justify-center bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700`}
          >
            <div className="text-center text-white">
              <Users className="h-6 w-6 mx-auto mb-1" />
              <span className="text-xs">
                +{otherSpeakers.length - layoutConfig.maxVisibleParticipants + 1}{' '}
                more
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
