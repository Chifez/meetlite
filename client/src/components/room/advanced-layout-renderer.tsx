import { useMemo } from 'react';
import { LayoutEngine, LayoutEngineOptions } from '@/utils/layout-engine';
import { Participant } from '@/components/room/types';
import { LayoutMode } from '@/components/room/layout-toggle';
import { useRoom } from '@/contexts/room-context';

// Layout Adapters
import { SingleLayout } from './layouts/single-layout';
import { SideBySideLayout } from './layouts/side-by-side-layout';
import { SpeakerLayout } from './layouts/speaker-layout';
import { GridLayout } from './layouts/grid-layout';
import { PresentationLayout } from './layouts/presentation-layout';
import { BaseLayoutProps } from './layouts/base-layout-props';

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
  activeSpeakerId?: string | null;
  pinnedParticipant?: string | null;
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
  activeSpeakerId = null,
  pinnedParticipant = null,
  className = '',
}: AdvancedLayoutRendererProps) => {

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
      isActiveSpeaker: participant.id === activeSpeakerId,
    }));

    return participantsWithPriority.sort((a, b) => {
      // Pinned participant always comes first
      if (a.id === pinnedParticipant) return -1;
      if (b.id === pinnedParticipant) return 1;

      // Then by priority score
      return b.priority - a.priority;
    });
  }, [participants, layoutConfig, pinnedParticipant, activeSpeakerId]);

  // Get layout-specific CSS classes
  const layoutClasses = useMemo(() => {
    return LayoutEngine.getLayoutClasses(layoutConfig);
  }, [layoutConfig]);

  // Handle participant pinning
  const { setPinnedParticipant } = useRoom();
  const handlePinParticipant = (participantId: string) => {
    if (setPinnedParticipant) {
      setPinnedParticipant(
        pinnedParticipant === participantId ? null : participantId
      );
    }
  };

  const baseProps: BaseLayoutProps = {
    participants: sortedParticipants,
    layoutConfig,
    layoutMode,
    layoutClasses,
    onPinParticipant: handlePinParticipant,
    screenSize,
  };

  // Main render logic based on layout type (Seam delegation)
  const renderLayout = () => {
    switch (layoutConfig.layoutType) {
      case 'single':
        return <SingleLayout {...baseProps} />;
      case 'side-by-side':
        return <SideBySideLayout {...baseProps} />;
      case 'auto-mode':
        return <SpeakerLayout {...baseProps} />;
      case 'presentation':
        return <PresentationLayout {...baseProps} />;
      case 'grid':
      default:
        return <GridLayout {...baseProps} />;
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
