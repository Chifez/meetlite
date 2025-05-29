import { VideoOff, MicOff, Loader2 } from 'lucide-react';
import { VideoParticipantProps } from './types';
import { useEffect, useRef, useState } from 'react';

export const VideoParticipant = ({
  stream,
  mediaState,
  isLocal,
  isLoading = false,
}: VideoParticipantProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState<boolean>(false);

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

  // Update video visibility when mediaState changes
  // useEffect(() => {
  //   const videoElement = videoRef.current;
  //   if (videoElement && stream) {
  //     if (!mediaState.videoEnabled) {
  //       videoElement.style.display = 'none';
  //     } else {
  //       videoElement.style.display = 'block';
  //     }
  //   }
  // }, [mediaState.videoEnabled, stream]);

  const showVideoOff = !mediaState.videoEnabled;
  const showError = videoError && !isLocal;
  const showLoading = isLoading && !isLocal && !stream;

  return (
    <div className="relative bg-muted rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
      />

      {(showVideoOff || showError || showLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          {showLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              <span className="text-sm text-muted-foreground">
                Connecting...
              </span>
            </div>
          ) : showVideoOff ? (
            <VideoOff className="h-12 w-12 text-muted-foreground" />
          ) : null}
          {showError && (
            <div className="absolute bottom-2 left-2 text-xs text-red-500">
              Video Error
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-2 text-sm text-white bg-black/50 px-2 py-1 rounded">
        <span>{isLocal ? 'You' : 'Participant'}</span>
        {!mediaState.audioEnabled && (
          <MicOff className="h-4 w-4 text-white/75" />
        )}
      </div>
    </div>
  );
};
