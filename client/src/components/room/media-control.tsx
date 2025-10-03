import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  Monitor,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { ControlButton } from '@/components/room/control-button';
import { useRoom } from '@/contexts/room-context';
import { Badge } from '@/components/ui/badge';

interface MediaControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  canShareScreen: boolean | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onShareScreen: () => void;
  onLeaveMeeting: () => void;
  showScreenShare?: boolean;
}

export const MediaControls = ({
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  canShareScreen,
  onToggleAudio,
  onToggleVideo,
  onShareScreen,
  onLeaveMeeting,
  showScreenShare = true,
}: MediaControlsProps) => {
  const { chatState, toggleChatPanel, collaborationState } = useRoom();

  // Disable screen sharing when presenting
  const isPresenting = collaborationState?.mode !== 'none';
  const canShare = canShareScreen && !isPresenting;

  return (
    <div className="flex items-center gap-3 justify-center">
      <ControlButton
        icon={Mic}
        iconAlt={MicOff}
        onClick={onToggleAudio}
        isActive={audioEnabled}
      />

      <ControlButton
        icon={Video}
        iconAlt={VideoOff}
        onClick={onToggleVideo}
        isActive={videoEnabled}
      />

      <ControlButton icon={Phone} onClick={onLeaveMeeting} isDestructive />

      {showScreenShare && (
        <ControlButton
          icon={MonitorUp}
          iconAlt={canShare ? Monitor : MonitorOff}
          onClick={onShareScreen}
          disabled={!canShare}
          isActive={isScreenSharing}
          className="hidden md:inline-flex"
          title={
            isPresenting ? 'Cannot share screen while presenting' : undefined
          }
        />
      )}

      <div className="relative">
        <ControlButton
          icon={MessageCircle}
          onClick={toggleChatPanel}
          isActive={chatState.isOpen}
        />
        {chatState.unreadCount > 0 && !chatState.isOpen && (
          <Badge
            variant="destructive"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 items-center justify-center text-xs flex"
          >
            {chatState.unreadCount > 9 ? '9+' : chatState.unreadCount}
          </Badge>
        )}
      </div>
    </div>
  );
};
