import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VideoPlayer } from './video-player';
import { InfoPanel } from './info-panel';
import type { MeetingRecording } from '../../../services/meetingAssetsService';

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
  if (!recording) return null;

  const videoUrl = streamingUrl || recording.recording.streamingUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1200px] h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col h-full min-h-0">
          {/* Video Player Section - Takes 50% of height */}
          <div
            className="w-full bg-black relative flex-shrink-0"
            style={{ height: '45vh' }}
          >
            <VideoPlayer recording={recording} videoUrl={videoUrl} />
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
