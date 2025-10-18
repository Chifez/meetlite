import { useMemo, useState } from 'react';
import { EnhancedVideoParticipant } from '@/components/room/enhanced-video-participant';
import { LayoutEngine, LayoutEngineOptions } from '@/utils/layout-engine';
import { Participant } from '@/components/room/types';
import { LayoutMode } from '@/components/room/layout-toggle';
import { Users, User } from 'lucide-react';

interface AdvancedLayoutRendererProps {
  participants: Participant[];
  layoutMode: LayoutMode;
  screenSize: 'small' | 'medium' | 'large';
  isPresenting?: boolean;
  hasActiveSpeaker?: boolean;
  bandwidthMode?: 'high' | 'medium' | 'low';
  userPreferences?: {
    showSelfView: boolean;
    preferSpeakerView: boolean;
    autoSwitchLayout: boolean;
  };
  className?: string;
}

export const AdvancedLayoutRenderer = ({
  participants,
  layoutMode,
  screenSize,
  isPresenting = false,
  hasActiveSpeaker = false,
  bandwidthMode = 'high',
  userPreferences = {
    showSelfView: true,
    preferSpeakerView: true,
    autoSwitchLayout: true,
  },
  className = '',
}: AdvancedLayoutRendererProps) => {
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(
    null
  );
  const [activeSpeaker] = useState<string | null>(null);

  // Compute layout configuration
  const layoutConfig = useMemo(() => {
    const options: LayoutEngineOptions = {
      participantCount: participants.length,
      screenSize,
      isPresenting,
      hasActiveSpeaker,
      bandwidthMode,
      userPreferences,
    };

    return LayoutEngine.computeLayout(options);
  }, [
    participants.length,
    screenSize,
    isPresenting,
    hasActiveSpeaker,
    bandwidthMode,
    userPreferences,
  ]);

  // Sort participants by priority
  const sortedParticipants = useMemo(() => {
    const participantsWithPriority = participants.map((participant) => ({
      ...participant,
      priority: LayoutEngine.getParticipantPriority(participant, layoutConfig),
      isActiveSpeaker: participant.id === activeSpeaker, // Add active speaker detection
    }));

    return participantsWithPriority.sort((a, b) => {
      // Pinned participant always comes first
      if (a.id === pinnedParticipant) return -1;
      if (b.id === pinnedParticipant) return 1;

      // Then by priority score
      return b.priority - a.priority;
    });
  }, [participants, layoutConfig, pinnedParticipant, activeSpeaker]);

  // Get layout-specific CSS classes
  const layoutClasses = useMemo(() => {
    return LayoutEngine.getLayoutClasses(layoutConfig);
  }, [layoutConfig]);

  // Handle participant pinning
  const handlePinParticipant = (participantId: string) => {
    setPinnedParticipant(
      pinnedParticipant === participantId ? null : participantId
    );
  };

  // Render single participant layout
  const renderSingleParticipantLayout = () => {
    const participant = participants[0];

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
            <span className="text-lg font-medium">
              You're the only one here
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Invite others to join your meeting
          </p>
        </div>
      </div>
    );
  };

  // Render side-by-side layout for 2 participants
  const renderSideBySideLayout = () => {
    const [first, second] = sortedParticipants;

    return (
      <div
        className={`flex ${
          screenSize === 'small' ? 'flex-col' : 'flex-row'
        } h-full ${layoutClasses.container}`}
      >
        <div
          className={`flex-1 ${screenSize === 'small' ? 'mb-4' : 'mr-4'} ${
            first.isActiveSpeaker ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
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
            isMainSpeaker={first.priority > second.priority}
          />
        </div>
        <div
          className={`flex-1 ${
            second.isActiveSpeaker ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
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
            isMainSpeaker={second.priority > first.priority}
          />
        </div>
      </div>
    );
  };

  // Render speaker-focused layout (large meetings)
  const renderSpeakerLayout = () => {
    const [mainSpeaker, ...otherSpeakers] = sortedParticipants;

    return (
      <div
        className={`flex ${
          screenSize === 'small' ? 'flex-col' : 'flex-row'
        } h-full ${layoutClasses.container}`}
      >
        {/* Main Speaker */}
        <div
          className={`${
            screenSize === 'small' ? 'flex-1 mb-4' : 'flex-1 mr-4'
          }`}
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
                onClick={() => handlePinParticipant(participant.id)}
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
                  +
                  {otherSpeakers.length -
                    layoutConfig.maxVisibleParticipants +
                    1}{' '}
                  more
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render grid layout with CSS Grid and fr units
  const renderGridLayout = () => {
    const visibleParticipants = sortedParticipants.slice(
      0,
      layoutConfig.maxVisibleParticipants
    );

    const participantCount = visibleParticipants.length;
    const { gridCols } = layoutConfig;

    // Special handling for small participant counts with custom layouts
    // Use threshold constant for better maintainability
    const isThreeParticipants = participantCount === 3; // LAYOUT_CONSTANTS.THREE_PARTICIPANTS
    if (isThreeParticipants && gridCols >= 3) {
      return (
        <div
          className={`${layoutClasses.container} flex flex-col ${layoutConfig.gap} items-center justify-center h-full`}
        >
          {/* First row: 2 participants */}
          <div className="flex flex-row gap-3 w-full max-w-4xl">
            {visibleParticipants.slice(0, 2).map((participant) => (
              <div
                key={participant.id}
                className={`flex-1 ${layoutClasses.participant} ${
                  participant.isActiveSpeaker
                    ? 'ring-2 ring-blue-400 ring-opacity-50'
                    : ''
                }`}
                onClick={() => handlePinParticipant(participant.id)}
              >
                <EnhancedVideoParticipant
                  stream={participant.stream}
                  mediaState={participant.mediaState}
                  isLocal={participant.isLocal}
                  isLoading={participant.isLoading}
                  userEmail={participant.userEmail}
                  userName={participant.userName}
                  layoutMode={layoutMode}
                  isMainSpeaker={participant.priority > 50}
                />
              </div>
            ))}
          </div>

          {/* Second row: 1 participant centered */}
          <div className="flex flex-row gap-3 w-full max-w-4xl justify-center">
            {visibleParticipants.slice(2, 3).map((participant) => (
              <div
                key={participant.id}
                className={`flex-1 max-w-md ${layoutClasses.participant} ${
                  participant.isActiveSpeaker
                    ? 'ring-2 ring-blue-400 ring-opacity-50'
                    : ''
                }`}
                onClick={() => handlePinParticipant(participant.id)}
              >
                <EnhancedVideoParticipant
                  stream={participant.stream}
                  mediaState={participant.mediaState}
                  isLocal={participant.isLocal}
                  isLoading={participant.isLoading}
                  userEmail={participant.userEmail}
                  userName={participant.userName}
                  layoutMode={layoutMode}
                  isMainSpeaker={participant.priority > 50}
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
          {/* First row: 3 participants */}
          <div className="flex flex-row gap-2">
            {visibleParticipants.slice(0, 3).map((participant) => (
              <div
                key={participant.id}
                className={`${layoutClasses.participant} ${
                  participant.isActiveSpeaker
                    ? 'ring-2 ring-blue-400 ring-opacity-50'
                    : ''
                }`}
                onClick={() => handlePinParticipant(participant.id)}
              >
                <EnhancedVideoParticipant
                  stream={participant.stream}
                  mediaState={participant.mediaState}
                  isLocal={participant.isLocal}
                  isLoading={participant.isLoading}
                  userEmail={participant.userEmail}
                  userName={participant.userName}
                  layoutMode={layoutMode}
                  isMainSpeaker={participant.priority > 50}
                />
              </div>
            ))}
          </div>
          {/* Second row: 2 participants centered */}
          <div className="flex flex-row gap-2 justify-center">
            {visibleParticipants.slice(3, 5).map((participant) => (
              <div
                key={participant.id}
                className={`${layoutClasses.participant} ${
                  participant.isActiveSpeaker
                    ? 'ring-2 ring-blue-400 ring-opacity-50'
                    : ''
                }`}
                onClick={() => handlePinParticipant(participant.id)}
              >
                <EnhancedVideoParticipant
                  stream={participant.stream}
                  mediaState={participant.mediaState}
                  isLocal={participant.isLocal}
                  isLoading={participant.isLoading}
                  userEmail={participant.userEmail}
                  userName={participant.userName}
                  layoutMode={layoutMode}
                  isMainSpeaker={participant.priority > 50}
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
          {/* First two rows: 3 participants each */}
          {[0, 1].map((rowIndex) => (
            <div key={rowIndex} className="flex flex-row gap-2">
              {visibleParticipants
                .slice(rowIndex * 3, (rowIndex + 1) * 3)
                .map((participant) => (
                  <div
                    key={participant.id}
                    className={`${layoutClasses.participant} ${
                      participant.isActiveSpeaker
                        ? 'ring-2 ring-blue-400 ring-opacity-50'
                        : ''
                    }`}
                    onClick={() => handlePinParticipant(participant.id)}
                  >
                    <EnhancedVideoParticipant
                      stream={participant.stream}
                      mediaState={participant.mediaState}
                      isLocal={participant.isLocal}
                      isLoading={participant.isLoading}
                      userEmail={participant.userEmail}
                      userName={participant.userName}
                      layoutMode={layoutMode}
                      isMainSpeaker={participant.priority > 50}
                    />
                  </div>
                ))}
            </div>
          ))}
          {/* Last row: 1 participant centered */}
          <div className="flex flex-row gap-2 justify-center">
            {visibleParticipants.slice(6, 7).map((participant) => (
              <div
                key={participant.id}
                className={`${layoutClasses.participant} ${
                  participant.isActiveSpeaker
                    ? 'ring-2 ring-blue-400 ring-opacity-50'
                    : ''
                }`}
                onClick={() => handlePinParticipant(participant.id)}
              >
                <EnhancedVideoParticipant
                  stream={participant.stream}
                  mediaState={participant.mediaState}
                  isLocal={participant.isLocal}
                  isLoading={participant.isLoading}
                  userEmail={participant.userEmail}
                  userName={participant.userName}
                  layoutMode={layoutMode}
                  isMainSpeaker={participant.priority > 50}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Default grid layout with CSS Grid and fr units for equal space distribution
    // Calculate centering for uneven participant counts
    const calculateGridCentering = () => {
      const totalSlots = layoutConfig.gridCols * layoutConfig.gridRows;
      const remainingSlots = totalSlots - participantCount;

      if (remainingSlots > 0) {
        // Calculate how many empty slots are in the last row
        const lastRowParticipants = participantCount % layoutConfig.gridCols;
        const emptySlotsInLastRow =
          lastRowParticipants === 0
            ? 0
            : layoutConfig.gridCols - lastRowParticipants;

        return {
          hasEmptySlots: emptySlotsInLastRow > 0,
          emptySlotsInLastRow,
          shouldCenterLastRow:
            emptySlotsInLastRow > 0 &&
            emptySlotsInLastRow < layoutConfig.gridCols,
        };
      }

      return {
        hasEmptySlots: false,
        emptySlotsInLastRow: 0,
        shouldCenterLastRow: false,
      };
    };

    const centeringInfo = calculateGridCentering();

    return (
      <div
        className={`${layoutClasses.container} ${layoutClasses.grid}`}
        style={{
          gridTemplateColumns: `repeat(${layoutConfig.gridCols}, 1fr)`,
          gridTemplateRows: `repeat(${layoutConfig.gridRows}, 1fr)`,
          justifyContent: centeringInfo.shouldCenterLastRow
            ? 'center'
            : 'stretch',
          transform: `scale(${layoutClasses.zoomScale})`, // Apply zoom scale
          transformOrigin: 'center center', // Scale from center
        }}
      >
        {visibleParticipants.map((participant) => (
          <div
            key={participant.id}
            className={`${layoutClasses.participant} ${
              participant.isActiveSpeaker
                ? 'ring-2 ring-blue-400 ring-opacity-50'
                : ''
            }`}
            onClick={() => handlePinParticipant(participant.id)}
          >
            <EnhancedVideoParticipant
              stream={participant.stream}
              mediaState={participant.mediaState}
              isLocal={participant.isLocal}
              isLoading={participant.isLoading}
              userEmail={participant.userEmail}
              userName={participant.userName}
              layoutMode={layoutMode}
              isMainSpeaker={participant.priority > 50}
            />
          </div>
        ))}

        {/* Show more participants indicator for scrollable grids */}
        {layoutConfig.scrollable &&
          sortedParticipants.length > layoutConfig.maxVisibleParticipants && (
            <div
              className={`${layoutClasses.participant} flex items-center justify-center bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700`}
            >
              <div className="text-center text-white">
                <Users className="h-6 w-6 mx-auto mb-1" />
                <span className="text-xs">
                  +
                  {sortedParticipants.length -
                    layoutConfig.maxVisibleParticipants}{' '}
                  more
                </span>
              </div>
            </div>
          )}
      </div>
    );
  };

  // Render presentation layout
  const renderPresentationLayout = () => {
    const visibleParticipants = sortedParticipants.slice(
      0,
      layoutConfig.maxVisibleParticipants
    );

    return (
      <div className="w-full h-full flex flex-col">
        {/* Filmstrip Container - Full height, 2 columns */}
        <div className="flex flex-col h-full w-full">
          {/* Filmstrip Grid - Dynamic columns based on screen size */}
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
                className="relative aspect-[16/9] min-h-0 min-w-0 transition-all duration-300 ease-in-out rounded-lg overflow-hidden hover:shadow-xl"
                onClick={() => handlePinParticipant(participant.id)}
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

            {/* Show remaining participants indicator if needed */}
            {sortedParticipants.length >
              layoutConfig.maxVisibleParticipants && (
              <div className="relative aspect-[16/9] min-h-0 min-w-0 flex items-center justify-center bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-all duration-300 ease-in-out overflow-hidden">
                <div className="text-center text-white">
                  <Users className="h-6 w-6 mx-auto mb-1" />
                  <span className="text-xs font-medium">
                    +
                    {sortedParticipants.length -
                      layoutConfig.maxVisibleParticipants}{' '}
                    more
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Main render logic based on layout type
  const renderLayout = () => {
    switch (layoutConfig.layoutType) {
      case 'single':
        return renderSingleParticipantLayout();
      case 'side-by-side':
        return renderSideBySideLayout();
      case 'auto-mode':
        return renderSpeakerLayout();
      case 'presentation':
        return renderPresentationLayout();
      case 'grid':
      default:
        return renderGridLayout();
    }
  };

  return (
    <div className={`w-full h-full ${className}`}>
      {renderLayout()}

      {/* Layout Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs p-2 rounded">
          <div>Layout: {layoutConfig.layoutType}</div>
          <div>Participants: {participants.length}</div>
          <div>Mode: {layoutConfig.mode}</div>
          <div>
            Grid: {layoutConfig.gridCols}x{layoutConfig.gridRows}
          </div>
        </div>
      )}
    </div>
  );
};
