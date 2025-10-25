import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecordingActionsDropdown } from '@/components/recordings/recording-actions-dropdown';
import { RecordingMetadata } from '@/components/recordings/recording-metadata';
import { RecordingStats } from '@/components/recordings/recording-stats';
import { Play, Eye, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingRecording } from '@/types/meetingAssets';
import VideoHeader from '@/components/recordings/video-player/video-header';
import { useThumbnailManager } from '@/hooks/use-thumbnail-manager';
import { hasValidTags, getValidTags } from '@/utils/tags';

interface RecordingCardProps {
  recording: MeetingRecording;
  onPlay: (recording: MeetingRecording) => void;
  onEdit: (recording: MeetingRecording) => void;
  onDelete: (recording: MeetingRecording) => void;
  onArchive?: (recording: MeetingRecording) => void;
  onUnarchive?: (recording: MeetingRecording) => void;
  onDownloadTranscript: (recording: MeetingRecording) => void;
  onStartProcessing: (
    recording: MeetingRecording,
    type: 'transcript' | 'summary' | 'both'
  ) => void;
  onShare: (recording: MeetingRecording) => void;
  isProcessing?: boolean;
  processingProgress?: number;
  className?: string;
}

export const RecordingCard: React.FC<RecordingCardProps> = ({
  recording,
  onPlay,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  onDownloadTranscript,
  onStartProcessing,
  onShare,
  isProcessing = false,
  processingProgress = 0,
  className,
}) => {
  const recordingId = recording.id || recording._id || '';
  const {
    thumbnailError,
    freshThumbnailUrl,
    isLoadingThumbnail,
    handleThumbnailError,
  } = useThumbnailManager(recordingId);

  return (
    <div>
      <Card
        className={cn('group hover:shadow-lg transition-shadow', className)}
      >
        <VideoHeader
          recording={recording}
          isProcessing={isProcessing}
          processingProgress={processingProgress}
          thumbnailError={thumbnailError}
          setThumbnailError={handleThumbnailError}
          freshThumbnailUrl={freshThumbnailUrl || undefined}
          isLoadingThumbnail={isLoadingThumbnail}
        />

        <CardHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">
                {recording.title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {recording.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="default"
                className="h-5 w-5 p-0 flex items-center justify-center"
                onClick={() => onPlay(recording)}
              >
                <Play className="w-3 h-3" />
              </Button>
              <RecordingActionsDropdown
                recording={recording}
                onPlay={onPlay}
                onEdit={onEdit}
                onDelete={onDelete}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onShare={onShare}
                onDownloadTranscript={onDownloadTranscript}
                onStartProcessing={onStartProcessing}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-3">
          <RecordingMetadata recording={recording} />
          <RecordingStats recording={recording} />

          {/* Tags */}
          {hasValidTags(recording.tags) && (
            <div className="h-5 flex items-center gap-1">
              <div className="flex flex-wrap gap-1">
                {getValidTags(recording.tags)
                  .slice(0, 3)
                  .map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                {getValidTags(recording.tags).length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{getValidTags(recording.tags).length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Analytics */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>{recording.analytics.viewCount} views</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>{recording.analytics.downloadCount} downloads</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
