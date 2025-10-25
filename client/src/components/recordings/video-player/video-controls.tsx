import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
} from 'lucide-react';

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onSkipTime: (seconds: number) => void;
  onToggleFullscreen: () => void;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isFullscreen,
  onTogglePlay,
  onSeek,
  onToggleMute,
  onVolumeChange,
  onSkipTime,
  onToggleFullscreen,
}) => {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 lg:p-4">
      {/* Progress Bar */}
      <div className="mb-3 lg:mb-4">
        <div className="relative bg-white/20 rounded-full h-1 lg:h-1.5 cursor-pointer">
          <div
            className="absolute top-0 left-0 bg-blue-500 rounded-full h-full"
            style={{
              width: `${duration ? (currentTime / duration) * 100 : 0}%`,
            }}
          />
          <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Skip Back */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSkipTime(-10)}
            className="text-white hover:bg-white/20 p-2 lg:p-2.5"
          >
            <SkipBack className="h-4 w-4 lg:h-5 lg:w-5" />
          </Button>

          {/* Play/Pause */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onTogglePlay}
            className="text-white hover:bg-white/20 p-2 lg:p-2.5"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 lg:h-6 lg:w-6" />
            ) : (
              <Play className="h-5 w-5 lg:h-6 lg:w-6" />
            )}
          </Button>

          {/* Skip Forward */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSkipTime(10)}
            className="text-white hover:bg-white/20 p-2 lg:p-2.5"
          >
            <SkipForward className="h-4 w-4 lg:h-5 lg:w-5" />
          </Button>

          {/* Volume Controls */}
          <div className="flex items-center gap-2 ml-2 lg:ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleMute}
              className="text-white hover:bg-white/20 p-2 lg:p-2.5"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 lg:h-5 lg:w-5" />
              ) : (
                <Volume2 className="h-4 w-4 lg:h-5 lg:w-5" />
              )}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-12 lg:w-16 h-1.5 lg:h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>

          {/* Time Display */}
          <span className="text-white text-xs lg:text-sm ml-3 lg:ml-4 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Fullscreen Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleFullscreen}
          className="text-white hover:bg-white/20 p-2 lg:p-2.5"
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4 lg:h-5 lg:w-5" />
          ) : (
            <Maximize className="h-4 w-4 lg:h-5 lg:w-5" />
          )}
        </Button>
      </div>
    </div>
  );
};
