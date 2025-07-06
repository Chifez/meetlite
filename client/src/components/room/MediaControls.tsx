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
import { ControlButton } from './ControlButton';
import { useRoom } from '@/contexts/RoomContext';
import { Badge } from '@/components/ui/badge';

interface MediaControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  canShareScreen: boolean;
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
  const { chatState, toggleChatPanel } = useRoom();

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
          iconAlt={canShareScreen ? Monitor : MonitorOff}
          onClick={onShareScreen}
          disabled={!canShareScreen}
          isActive={isScreenSharing}
          className="hidden md:inline-flex"
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
