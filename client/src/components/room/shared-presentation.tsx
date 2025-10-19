import React from 'react';
import { WorkflowPanel } from '@/components/room/collaboration/workflow-panel';
import { WhiteboardPanel } from '@/components/room/collaboration/whiteboard-panel';
import { MobileVideoLayout } from '@/components/room/layouts/mobile-video-layout';
import { AdvancedLayoutRenderer } from '@/components/room/advanced-layout-renderer';
import { useRoom } from '@/contexts/room-context';
import { useLayoutManager } from '@/hooks/use-layout-manager';
import { useBandwidthOptimization } from '@/hooks/use-bandwidth-optimization';
import { useMemo } from 'react';

interface SharedPresentationProps {
  mode: 'workflow' | 'whiteboard';
}

export const SharedPresentation: React.FC<SharedPresentationProps> = ({
  mode,
}) => {
  const {
    localStream,
    peers,
    peerMediaState,
    videoEnabled,
    audioEnabled,
    getParticipantEmail,
    getParticipantDisplayName,
  } = useRoom();

  const { layoutMode, screenSize } = useLayoutManager();

  // Calculate participant count
  const participantCount = peers.size + 1; // +1 for local user

  // Memoize bandwidth optimization options to prevent infinite loops
  const bandwidthOptions = useMemo(
    () => ({
      participantCount: participantCount,
      connectionQuality: 'good' as const, // TODO: Get from connection monitoring
      deviceCapability: 'high' as const, // TODO: Detect device capability
      userPreference: 'balanced' as const, // TODO: Get from user settings
    }),
    [participantCount]
  );

  // Bandwidth optimization
  const { bandwidthSettings } = useBandwidthOptimization(bandwidthOptions);

  // Create array of all participants (local + peers) with user info
  const allParticipants = useMemo(
    () => [
      {
        id: 'local',
        stream: localStream,
        mediaState: { audioEnabled, videoEnabled },
        isLocal: true,
        isLoading: false,
        userEmail: undefined,
        userName: 'You',
      },
      ...Array.from(peers.entries()).map(([peerId, peer]) => {
        const participantEmail = getParticipantEmail(peer.id);
        const participantDisplayName = getParticipantDisplayName(peer.id);

        return {
          id: peerId,
          stream: peer.stream || null,
          mediaState: peerMediaState.get(peer.id) || {
            audioEnabled: true,
            videoEnabled: true,
          },
          isLocal: false,
          isLoading: peer.isLoading || false,
          userEmail: participantEmail,
          userName: participantDisplayName || participantEmail || 'Participant',
        };
      }),
    ],
    [
      localStream,
      audioEnabled,
      videoEnabled,
      peers,
      peerMediaState,
      getParticipantEmail,
      getParticipantDisplayName,
    ]
  );

  // Memoize user preferences to prevent unnecessary re-renders
  const userPreferences = useMemo(
    () => ({
      showSelfView: true,
      preferSpeakerView: layoutMode === 'speaker',
      autoSwitchLayout: true,
    }),
    [layoutMode]
  );

  // Render collaboration tool
  const renderCollaborationTool = () => (
    <div className="w-full h-full bg-[#121212] rounded-lg overflow-hidden border border-gray-700">
      {mode === 'workflow' ? (
        <WorkflowPanel className="w-full h-full" />
      ) : (
        <WhiteboardPanel className="w-full h-full" />
      )}
    </div>
  );

  // Unified layout: Same for both presenter and viewer, following screen sharing pattern
  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* Mobile: Collaboration tool takes 65% height */}
      <div className="md:hidden w-full h-[65%] mb-2 flex-shrink-0">
        {renderCollaborationTool()}
      </div>

      {/* Layout Container */}
      <div
        className={`flex-1 overflow-hidden ${'md:flex md:flex-row'} ${'md:h-full h-[35%]'}`}
      >
        {/* Desktop: Collaboration Tool */}
        <div className="hidden md:block w-[65%] h-full flex-shrink-0 pr-2">
          {renderCollaborationTool()}
        </div>

        {/* Participants Container */}
        <div className="md:w-[35%] h-full flex-1 overflow-hidden">
          {/* Advanced Layout Renderer */}
          <div className="hidden md:block w-full h-full">
            <AdvancedLayoutRenderer
              participants={allParticipants}
              layoutMode={layoutMode}
              screenSize={screenSize}
              isPresenting={true}
              hasActiveSpeaker={false}
              bandwidthMode={bandwidthSettings.mode}
              userPreferences={userPreferences}
            />
          </div>

          {/* Mobile Layout */}
          <MobileVideoLayout isPresenting={true} />
        </div>
      </div>
    </div>
  );
};
