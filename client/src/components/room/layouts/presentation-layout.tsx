import { BaseLayoutProps } from './base-layout-props';
import { EnhancedVideoParticipant } from '@/components/room/enhanced-video-participant';
import { Users } from 'lucide-react';

export const PresentationLayout = ({
  participants,
  layoutConfig,
  layoutMode,
  onPinParticipant,
}: BaseLayoutProps) => {
  const visibleParticipants = participants.slice(0, layoutConfig.maxVisibleParticipants);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-col h-full w-full">
        <div
          className={`grid gap-3 p-3 place-items-stretch ${
            layoutConfig.scrollable ? 'overflow-y-auto scrollbar-hide' : ''
          }`}
          style={{
            gridTemplateColumns: `repeat(${layoutConfig.gridCols}, 1fr)`,
            gridTemplateRows: `repeat(${layoutConfig.gridRows}, 1fr)`,
          }}
        >
          {visibleParticipants.map((participant) => (
            <div
              key={participant.id}
              className="relative aspect-[16/9] min-h-0 min-w-0 transition-[transform,shadow,opacity] duration-200 ease-out-strong rounded-lg overflow-hidden hover:shadow-xl"
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

          {participants.length > layoutConfig.maxVisibleParticipants && (
            <div className="relative aspect-[16/9] min-h-0 min-w-0 flex items-center justify-center bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-[background-color,transform] duration-200 ease-out-strong overflow-hidden">
              <div className="text-center text-white">
                <Users className="h-6 w-6 mx-auto mb-1" />
                <span className="text-xs font-medium">
                  +{participants.length - layoutConfig.maxVisibleParticipants} more
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
