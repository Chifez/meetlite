import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VideoPlayer } from '@/components/recordings/video-player/video-player';
import { InfoPanel } from '@/components/recordings/video-player/info-panel';
import { Loader2 } from 'lucide-react';
import { meetingAssetsService } from '@/services/meeting-assets-service';
import type { MeetingRecording } from '@/services/meeting-assets-service';

interface VideoPlayerModalProps {
  recording: MeetingRecording | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadTranscript: (recording: MeetingRecording) => void;
  onStartProcessing: (
    recording: MeetingRecording,
    type: 'transcript' | 'summary' | 'both'
  ) => void;
  streamingUrl?: string;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  recording,
  open,
  onOpenChange,
  onDownloadTranscript,
  onStartProcessing,
  streamingUrl,
}) => {
  const [freshUrls, setFreshUrls] = useState<{
    streamingUrl?: string;
    thumbnailUrl?: string;
  }>({});
  const [isLoadingUrls, setIsLoadingUrls] = useState(false);

  useEffect(() => {
    if (open && recording) {
      fetchFreshUrls();
    }
  }, [open, recording]);

  const fetchFreshUrls = async () => {
    if (!recording) return;

    setIsLoadingUrls(true);
    try {
      const recordingId = recording.id || recording._id;
      if (!recordingId) {
        throw new Error('Recording ID not found');
      }

      const urls = await meetingAssetsService.getStreamingUrl(recordingId);
      setFreshUrls(urls);
    } catch (error) {
      console.error('Failed to fetch fresh URLs:', error);
      // Fallback to empty URLs to prevent console errors
      setFreshUrls({
        streamingUrl: '',
        thumbnailUrl: '',
      });
    } finally {
      setIsLoadingUrls(false);
    }
  };

  if (!recording) return null;

  const videoUrl = freshUrls.streamingUrl || streamingUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1200px] h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col h-full min-h-0">
          {/* Video Player Section - Takes 50% of height */}
          <div
            className="w-full bg-black relative flex-shrink-0"
            style={{ height: '45vh' }}
          >
            {isLoadingUrls ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
                <span className="ml-2 text-white">Loading video...</span>
              </div>
            ) : (
              <VideoPlayer
                recording={recording}
                videoUrl={videoUrl}
                thumbnailUrl={freshUrls.thumbnailUrl}
              />
            )}
          </div>

          {/* Info Panel Section - Takes 50% of height with scrolling */}
          <div
            className="w-full bg-white border-t border-gray-200 flex-shrink-0 overflow-hidden"
            style={{ height: '45vh' }}
          >
            <InfoPanel
              recording={recording}
              onDownloadTranscript={onDownloadTranscript}
              onStartProcessing={onStartProcessing}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
