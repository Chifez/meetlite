import { BaseLayoutProps } from './base-layout-props';
import { EnhancedVideoParticipant } from '@/components/room/enhanced-video-participant';
import { User } from 'lucide-react';

export const SingleLayout = ({
  participants,
  layoutMode,
  layoutClasses,
}: BaseLayoutProps) => {
  const participant = participants[0];

  if (!participant) return null;

  return (
    <div
      className={`flex flex-col items-center justify-center h-full ${layoutClasses.container}`}
    >
      <div className={`${layoutClasses.mainSpeaker} max-w-2xl`}>
        <EnhancedVideoParticipant
          stream={participant.stream}
          mediaState={participant.mediaState}
          isLocal={participant.isLocal}
          isLoading={participant.isLoading}
          userEmail={participant.userEmail}
          userName={participant.userName}
          layoutMode={layoutMode}
          isMainSpeaker={true}
        />
      </div>

      {/* "You're the only one here" message */}
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-2 text-gray-400 mb-2">
          <User className="h-5 w-5" />
          <span className="text-lg font-medium">You're the only one here</span>
        </div>
        <p className="text-sm text-gray-500">
          Invite others to join your meeting
        </p>
      </div>
    </div>
  );
};
