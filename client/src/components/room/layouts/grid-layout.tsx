import { BaseLayoutProps } from './base-layout-props';
import { EnhancedVideoParticipant } from '@/components/room/enhanced-video-participant';
import { Users } from 'lucide-react';

export const GridLayout = ({
  participants,
  layoutConfig,
  layoutMode,
  layoutClasses,
  onPinParticipant,
}: BaseLayoutProps) => {
  const visibleParticipants = participants.slice(0, layoutConfig.maxVisibleParticipants);
  const participantCount = visibleParticipants.length;
  const { gridCols } = layoutConfig;

  // Special handling for 3 participants
  if (participantCount === 3 && gridCols >= 3) {
    return (
      <div
        className={`${layoutClasses.container} flex flex-col ${layoutConfig.gap} items-center justify-center h-full`}
      >
        <div className="flex flex-row gap-3 w-full max-w-4xl">
          {visibleParticipants.slice(0, 2).map((participant) => (
            <div
              key={participant.id}
              className={`flex-1 ${layoutClasses.participant} ${
                (participant as any).isActiveSpeaker ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
              }`}
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
                isMainSpeaker={(participant as any).priority > 50}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-row gap-3 w-full max-w-4xl justify-center">
          {visibleParticipants.slice(2, 3).map((participant) => (
            <div
              key={participant.id}
              className={`flex-1 max-w-md ${layoutClasses.participant} ${
                (participant as any).isActiveSpeaker ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
              }`}
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
                isMainSpeaker={(participant as any).priority > 50}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Special handling for 5 participants (3+2 centered)
  if (participantCount === 5 && gridCols >= 3) {
    return (
      <div
        className={`${layoutClasses.container} flex flex-col ${layoutConfig.gap} items-center justify-center`}
      >
        <div className="flex flex-row gap-2">
          {visibleParticipants.slice(0, 3).map((participant) => (
            <div
              key={participant.id}
              className={`${layoutClasses.participant} ${
                (participant as any).isActiveSpeaker ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
              }`}
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
                isMainSpeaker={(participant as any).priority > 50}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-row gap-2 justify-center">
          {visibleParticipants.slice(3, 5).map((participant) => (
            <div
              key={participant.id}
              className={`${layoutClasses.participant} ${
                (participant as any).isActiveSpeaker ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
              }`}
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
                isMainSpeaker={(participant as any).priority > 50}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Special handling for 7 participants (3+3+1 centered)
  if (participantCount === 7 && gridCols >= 3) {
    return (
      <div
        className={`${layoutClasses.container} flex flex-col ${layoutConfig.gap} items-center justify-center`}
      >
        {[0, 1].map((rowIndex) => (
          <div key={rowIndex} className="flex flex-row gap-2">
            {visibleParticipants.slice(rowIndex * 3, (rowIndex + 1) * 3).map((participant) => (
              <div
                key={participant.id}
                className={`${layoutClasses.participant} ${
                  (participant as any).isActiveSpeaker ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
                }`}
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
                  isMainSpeaker={(participant as any).priority > 50}
                />
              </div>
            ))}
          </div>
        ))}
        <div className="flex flex-row gap-2 justify-center">
          {visibleParticipants.slice(6, 7).map((participant) => (
            <div
              key={participant.id}
              className={`${layoutClasses.participant} ${
                (participant as any).isActiveSpeaker ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
              }`}
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
                isMainSpeaker={(participant as any).priority > 50}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default grid layout
  const calculateGridCentering = () => {
    const totalSlots = layoutConfig.gridCols * layoutConfig.gridRows;
    const remainingSlots = totalSlots - participantCount;

    if (remainingSlots > 0) {
      const lastRowParticipants = participantCount % layoutConfig.gridCols;
      const emptySlotsInLastRow = lastRowParticipants === 0 ? 0 : layoutConfig.gridCols - lastRowParticipants;
      return {
        shouldCenterLastRow: emptySlotsInLastRow > 0 && emptySlotsInLastRow < layoutConfig.gridCols,
      };
    }
    return { shouldCenterLastRow: false };
  };

  const centeringInfo = calculateGridCentering();

  return (
    <div
      className={`${layoutClasses.container} ${layoutClasses.grid}`}
      style={{
        gridTemplateColumns: `repeat(${layoutConfig.gridCols}, 1fr)`,
        gridTemplateRows: `repeat(${layoutConfig.gridRows}, 1fr)`,
        justifyContent: centeringInfo.shouldCenterLastRow ? 'center' : 'stretch',
        transform: `scale(${layoutClasses.zoomScale})`,
        transformOrigin: 'center center',
      }}
    >
      {visibleParticipants.map((participant) => (
        <div
          key={participant.id}
          className={`${layoutClasses.participant} ${
            (participant as any).isActiveSpeaker ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
          }`}
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
            isMainSpeaker={(participant as any).priority > 50}
          />
        </div>
      ))}

      {/* Show more participants indicator */}
      {layoutConfig.scrollable && participants.length > layoutConfig.maxVisibleParticipants && (
        <div className={`${layoutClasses.participant} flex items-center justify-center bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700`}>
          <div className="text-center text-white">
            <Users className="h-6 w-6 mx-auto mb-1" />
            <span className="text-xs">
              +{participants.length - layoutConfig.maxVisibleParticipants} more
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
