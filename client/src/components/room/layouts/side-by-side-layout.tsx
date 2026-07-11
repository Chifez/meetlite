import { BaseLayoutProps } from './base-layout-props';
import { EnhancedVideoParticipant } from '@/components/room/enhanced-video-participant';

export const SideBySideLayout = ({
  participants,
  layoutMode,
  screenSize,
}: BaseLayoutProps) => {
  const [first, second] = participants;

  if (!first || !second) return null;

  return (
    <div
      className={`flex ${
        screenSize === 'small' ? 'flex-col' : 'flex-row'
      } w-full h-full gap-3 p-3`}
    >
      <div
        className={`flex-1 min-w-0 min-h-0 ${
          (first as any).isActiveSpeaker ? 'ring-2 ring-blue-400/50 rounded-lg' : ''
        }`}
      >
        <EnhancedVideoParticipant
          stream={first.stream}
          mediaState={first.mediaState}
          isLocal={first.isLocal}
          isLoading={first.isLoading}
          userEmail={first.userEmail}
          userName={first.userName}
          layoutMode={layoutMode}
          isMainSpeaker={true}
        />
      </div>
      <div
        className={`flex-1 min-w-0 min-h-0 ${
          (second as any).isActiveSpeaker ? 'ring-2 ring-blue-400/50 rounded-lg' : ''
        }`}
      >
        <EnhancedVideoParticipant
          stream={second.stream}
          mediaState={second.mediaState}
          isLocal={second.isLocal}
          isLoading={second.isLoading}
          userEmail={second.userEmail}
          userName={second.userName}
          layoutMode={layoutMode}
          isMainSpeaker={false}
        />
      </div>
    </div>
  );
};
