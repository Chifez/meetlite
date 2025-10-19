import { VideoOff, MicOff, Loader2, Maximize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SpeakingIndicator } from '@/components/room/speaking-indicator';

interface EnhancedVideoParticipantProps {
  stream: MediaStream | null;
  mediaState: {
    audioEnabled: boolean;
    videoEnabled: boolean;
  };
  isLocal: boolean;
  isLoading?: boolean;
  userEmail?: string;
  userName?: string;
  layoutMode?: 'grid' | 'speaker' | 'presentation';
  isMainSpeaker?: boolean;
}

export const EnhancedVideoParticipant = ({
  stream,
  mediaState,
  isLocal,
  isLoading = false,
  userEmail,
  userName,
  layoutMode = 'grid',
  isMainSpeaker = false,
}: EnhancedVideoParticipantProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !stream) {
      return;
    }

    // Reset states
    setVideoError(false);

    // Set the stream
    videoElement.srcObject = stream;

    const handleLoadedMetadata = () => {
      if (!isLocal) {
        videoElement.play().catch((error) => {
          console.error('Error playing remote video:', error);
          setVideoError(true);
        });
      }
    };

    const handleCanPlay = () => {
      if (!isLocal && videoElement.paused) {
        videoElement.play().catch((error) => {
          console.error('Error playing remote video on canplay:', error);
          setVideoError(true);
        });
      }
    };

    const handleError = (error: Event) => {
      console.error(
        `Video error for ${isLocal ? 'local' : 'remote'} video:`,
        error
      );
      setVideoError(true);
    };

    // Add event listeners
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('error', handleError);

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('error', handleError);
    };
  }, [stream, isLocal]);

  const showVideoOff = !mediaState.videoEnabled;
  const showError = videoError && !isLocal;
  const showLoading = isLoading && !isLocal && !stream;

  // Determine display name with fallback
  const getDisplayName = () => {
    if (isLocal) return 'You';

    if (userName) {
      return userName.length > 20
        ? `${userName.substring(0, 20)}...`
        : userName;
    }

    if (userEmail) {
      return userEmail.length > 20
        ? `${userEmail.substring(0, 20)}...`
        : userEmail;
    }
    return 'Participant';
  };

  // Generate dynamic background color based on user name/email (Google Meet color scheme)
  const getDynamicBackgroundColor = () => {
    const name = userName || userEmail || 'Participant';
    const colors = [
      'bg-blue-500', // Google Blue
      'bg-green-500', // Google Green
      'bg-purple-500', // Google Purple
      'bg-yellow-500', // Google Yellow
      'bg-pink-500', // Google Pink
      'bg-indigo-500', // Google Indigo
      'bg-teal-500', // Google Teal
      'bg-orange-500', // Google Orange
      'bg-cyan-500', // Google Cyan
      'bg-emerald-500', // Google Emerald
    ];

    // Simple hash function to get consistent color for same name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  };

  // Get camera-off icon size based on layout mode
  const getCameraOffIconSize = () => {
    if (layoutMode === 'presentation') {
      return 'h-8 w-8'; // Smaller for presentation mode
    }
    if (layoutMode === 'speaker' && !isMainSpeaker) {
      return 'h-6 w-6'; // Smaller for speaker thumbnails
    }
    return 'h-12 w-12'; // Default size for main grids
  };

  // Get appropriate styling based on layout mode and speaker status
  const getContainerClasses = () => {
    const baseClasses =
      'relative bg-muted rounded-lg overflow-hidden w-full h-full min-w-0 min-h-0 transition-all duration-200';

    if (isMainSpeaker) {
      return `${baseClasses} ring-2 ring-blue-500 shadow-lg`;
    }

    if (layoutMode === 'speaker') {
      return `${baseClasses} hover:ring-2 hover:ring-blue-400`;
    }

    if (layoutMode === 'presentation') {
      return `${baseClasses} hover:ring-2 hover:ring-gray-400`;
    }

    return `${baseClasses} hover:ring-2 hover:ring-blue-300`;
  };

  // Portrait tile styling for better face visibility
  const getVideoClasses = () => {
    const baseClasses = 'w-full h-full object-cover';

    if (layoutMode === 'grid' && !isMainSpeaker) {
      // Portrait tiles: crop to show more face area
      return `${baseClasses} object-top object-cover`;
    }

    return baseClasses;
  };

  return (
    <div
      className={getContainerClasses()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={getVideoClasses()}
      />

      {/* Speaking Indicator */}
      <SpeakingIndicator
        stream={stream}
        isLocal={isLocal}
        audioEnabled={mediaState.audioEnabled}
      />

      {/* Video Off / Error / Loading States */}
      {(showVideoOff || showError || showLoading) && (
        <div
          className={`absolute inset-0 flex items-center justify-center ${getDynamicBackgroundColor()}`}
        >
          {showLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
              <span className="text-sm text-white">Connecting...</span>
            </div>
          ) : showVideoOff ? (
            <div className="bg-white/20 rounded-full p-3">
              <VideoOff className={`${getCameraOffIconSize()} text-white`} />
            </div>
          ) : null}
          {showError && (
            <div className="absolute bottom-2 left-2 text-xs text-red-200">
              Video Error
            </div>
          )}
        </div>
      )}

      {/* Participant Info Overlay */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2 text-sm text-white bg-black/50 px-2 py-1 rounded max-w-[calc(100%-1rem)]">
        <span className="truncate" title={userName || userEmail}>
          {getDisplayName()}
        </span>

        {/* Audio Status */}
        {!mediaState.audioEnabled && (
          <MicOff className="h-3 w-3 text-red-400 flex-shrink-0" />
        )}
      </div>

      {/* Hover Actions */}
      {isHovered && !isLocal && (
        <div className="absolute top-2 right-2">
          <button
            className="p-1 bg-black/50 hover:bg-black/70 rounded text-white transition-colors"
            title="Pin participant"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Main Speaker Indicator - Only border and audio visualizer */}
    </div>
  );
};
