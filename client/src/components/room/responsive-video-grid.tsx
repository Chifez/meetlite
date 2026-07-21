import { MobileVideoLayout } from '@/components/room/layouts/mobile-video-layout';
import { AdvancedLayoutRenderer } from '@/components/room/advanced-layout-renderer';
import { SharedScreen } from '@/components/room/shared-screen';
import { useRoom } from '@/contexts/room-context';
import { useLayoutManager } from '@/hooks/use-layout-manager';
import { useBandwidthOptimization } from '@/hooks/use-bandwidth-optimization';
import { useMemo, useEffect } from 'react';

export const ResponsiveVideoGrid = () => {
  const {
    localStream,
    peers,
    peerMediaState,
    videoEnabled,
    audioEnabled,
    getParticipantEmail,
    getParticipantDisplayName,
    screenStream,
    screenSharingUser,
    screenPeers,
    activeSpeakerId,
    audioLevels,
    pinnedParticipant,
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

  // Get the screen sharing stream from peers if we're not the one sharing
  const sharedScreenStream =
    screenStream ||
    (screenSharingUser &&
      Array.from(screenPeers.values()).find((p) => p.id === screenSharingUser)
        ?.stream) ||
    null;

  // Set consumer preferred layers based on bandwidth mode
  const { setConsumerLayer } = useRoom();
  
  useEffect(() => {
    if (!setConsumerLayer) return;
    
    let baseSpatialLayer = 1; // medium
    if (bandwidthSettings.mode === 'low') baseSpatialLayer = 0;

    // Apply to all current video consumers
    peers.forEach((peer, peerId) => {
      // Safely check for consumers, as P2P peers don't have them
      if (peer.consumers) {
        peer.consumers.forEach((consumer: any) => {
          if (consumer.kind === 'video') {
            // Determine spatial layer based on focus (pinned or active speaker)
            const isFocused = peerId === pinnedParticipant || (!pinnedParticipant && peerId === activeSpeakerId);
            const targetLayer = isFocused ? 2 : baseSpatialLayer; // 2 = high
            setConsumerLayer(consumer.id, targetLayer);
          }
        });
      }
    });
  }, [bandwidthSettings.mode, peers, setConsumerLayer, activeSpeakerId, pinnedParticipant]);

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
        isActiveSpeaker: activeSpeakerId === 'local',
        audioLevel: audioLevels['local'] || 0,
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
          isActiveSpeaker: activeSpeakerId === peerId,
          audioLevel: audioLevels[peerId] || 0,
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
      activeSpeakerId,
      audioLevels,
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

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* Mobile: Screen sharing takes 65% height */}
      {sharedScreenStream && (
        <div className="md:hidden w-full h-[65%] mb-2 flex-shrink-0">
          <SharedScreen stream={sharedScreenStream} />
        </div>
      )}

      {/* Layout Container */}
      <div
        className={`flex-1 overflow-hidden ${
          sharedScreenStream ? 'md:flex md:flex-row' : 'flex flex-col'
        } ${sharedScreenStream ? 'md:h-full h-[35%]' : 'h-full'}`}
      >
        {/* Desktop: Shared Screen */}
        {sharedScreenStream && (
          <div className="hidden md:block w-[65%] h-full flex-shrink-0 pr-2">
            <SharedScreen stream={sharedScreenStream} />
          </div>
        )}

        {/* Participants Container */}
        <div
          className={`flex-1 overflow-hidden ${
            sharedScreenStream ? 'md:w-[35%] h-full' : 'w-full h-full'
          }`}
        >
          {/* Advanced Layout Renderer */}
          <div className="hidden md:block w-full h-full">
            <AdvancedLayoutRenderer
              participants={allParticipants}
              layoutMode={layoutMode}
              screenSize={screenSize}
              isPresenting={!!sharedScreenStream}
              hasActiveSpeaker={!!activeSpeakerId}
              activeSpeakerId={activeSpeakerId}
              pinnedParticipant={pinnedParticipant}
              bandwidthMode={bandwidthSettings.mode}
              userPreferences={userPreferences}
            />
          </div>

          {/* Mobile Layout */}
          <MobileVideoLayout />
        </div>
      </div>
    </div>
  );
};
