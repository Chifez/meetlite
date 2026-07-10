import { Badge } from '@/components/ui/badge';
import { MeetingRecording } from '@/services/meeting-assets-service';
import { Progress } from '@/components/ui/progress';
import { Play } from 'lucide-react';

const VideoHeader = ({
  recording,
  thumbnailError,
  setThumbnailError,
  isProcessing = false,
  processingProgress = 0,
  freshThumbnailUrl,
  isLoadingThumbnail = false,
}: {
  recording: MeetingRecording;
  thumbnailError: boolean;
  setThumbnailError: (value: boolean) => void;
  isProcessing: boolean;
  processingProgress: number;
  freshThumbnailUrl?: string;
  isLoadingThumbnail?: boolean;
}) => {
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  console.log('thumbnail', freshThumbnailUrl);
  return (
    <div>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted rounded-t-lg overflow-hidden">
        {isLoadingThumbnail ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50"></div>
          </div>
        ) : !thumbnailError && freshThumbnailUrl ? (
          <img
            src={freshThumbnailUrl}
            alt={recording.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setThumbnailError(true)}
          />
        ) : (
          <div className="static -z-10 w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 group-hover:from-zinc-700 group-hover:to-zinc-800 transition-colors duration-300">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm shadow-sm group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300">
              <Play className="w-4 h-4 text-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Play Button Overlay */}

        {/* Duration Badge */}
        <Badge className="absolute top-2 right-2 bg-black/70 text-white">
          {formatDuration(recording.recording.duration)}
        </Badge>

        {/* Processing Progress */}
        {isProcessing && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
            <Progress value={processingProgress} className="h-1" />
            <p className="text-xs text-white mt-1">Processing...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoHeader;
