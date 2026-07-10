import { VideoOff, MicOff, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SpeakingIndicator } from '@/components/room/speaking-indicator';

interface VideoParticipantProps {
  stream: MediaStream | null;
  mediaState: {
    audioEnabled: boolean;
    videoEnabled: boolean;
  };
  isLocal: boolean;
  isLoading?: boolean;
  userEmail?: string;
  userName?: string;
  forceSpeaking?: boolean;
}

const getInitials = (name?: string, email?: string) => {
  const source = name || email || '?';
  if (source === '?') return '?';
  const parts = source.split('@')[0].split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export const VideoParticipant = ({
  stream,
  mediaState,
  isLocal,
  isLoading = false,
  userEmail,
  userName,
  forceSpeaking = false,
}: VideoParticipantProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState<boolean>(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !stream) {
      return;
    }

    setVideoError(false);
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

  const getDynamicAvatarColor = () => {
    const name = userName || userEmail || 'Participant';
    const colors = [
      'bg-primary/20 text-primary border-primary/30',
      'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
      'bg-amber-500/20 text-amber-500 border-amber-500/30',
      'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
      'bg-rose-500/20 text-rose-500 border-rose-500/30',
      'bg-sky-500/20 text-sky-500 border-sky-500/30',
      'bg-violet-500/20 text-violet-500 border-violet-500/30',
      'bg-teal-500/20 text-teal-500 border-teal-500/30',
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="relative bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden w-full h-full min-w-0 min-h-0">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
      />

      {/* Speaking Indicator */}
      <SpeakingIndicator
        stream={stream}
        isLocal={isLocal}
        audioEnabled={mediaState.audioEnabled}
        forceSpeaking={forceSpeaking}
      />

      {(showVideoOff || showError || showLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          {showLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <span className="text-xs text-zinc-400">Connecting...</span>
            </div>
          ) : showVideoOff ? (
            <div
              className={`w-16 h-16 rounded-full border flex items-center justify-center font-bold tracking-tight text-lg ${getDynamicAvatarColor()}`}
            >
              {getInitials(userName, userEmail)}
            </div>
          ) : null}
          {showError && (
            <div className="absolute bottom-2.5 left-2.5 text-[0.75rem] text-rose-400 font-medium">
              Video error
            </div>
          )}
        </div>
      )}

      {/* Participant Info Overlay */}
      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-[0.8125rem] text-white bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl max-w-[calc(100%-1.25rem)] border border-white/5">
        <span className="truncate font-medium" title={userName || userEmail}>
          {getDisplayName()}
        </span>
        {!mediaState.audioEnabled && (
          <MicOff className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
        )}
      </div>
    </div>
  );
};
