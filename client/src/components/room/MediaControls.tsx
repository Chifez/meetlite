import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  Monitor,
  Phone,
} from 'lucide-react';
import { ControlButton } from './ControlButton';

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
    </div>
  );
};
