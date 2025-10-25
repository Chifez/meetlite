import React, { useRef, useState, useEffect } from 'react';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VideoControls } from '@/components/recordings/video-player/video-controls';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { MeetingRecording } from '@/services/meeting-assets-service';

interface VideoPlayerProps {
  recording: MeetingRecording;
  videoUrl?: string;
  thumbnailUrl?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  recording,
  videoUrl,
  thumbnailUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = time;
    setCurrentTime(time);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
  };

  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    video.currentTime = newTime;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Header */}
      <DialogHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <DialogTitle className="text-white text-lg lg:text-xl">
          {recording.title}
        </DialogTitle>
        <p className="text-gray-300 text-sm">
          {format(new Date(recording.createdAt), 'MMM d, yyyy • h:mm a')}
        </p>
      </DialogHeader>

      {/* Video Element */}
      <div className="relative w-full h-full flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}

        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          poster={thumbnailUrl}
          preload="metadata"
        />
      </div>

      {/* Video Controls */}
      <VideoControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        isFullscreen={isFullscreen}
        onTogglePlay={togglePlay}
        onSeek={handleSeek}
        onToggleMute={toggleMute}
        onVolumeChange={handleVolumeChange}
        onSkipTime={skipTime}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  );
};
