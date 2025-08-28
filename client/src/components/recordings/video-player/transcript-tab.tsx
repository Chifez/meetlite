import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, MessageSquare, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingRecording } from '../../../services/meetingAssetsService';

interface TranscriptTabProps {
  recording: MeetingRecording;
  onDownloadTranscript: (recording: MeetingRecording) => void;
  onStartProcessing: (
    recording: MeetingRecording,
    type: 'transcript' | 'summary' | 'both'
  ) => void;
}

export const TranscriptTab: React.FC<TranscriptTabProps> = ({
  recording,
  onDownloadTranscript,
  onStartProcessing,
}) => {
  const [selectedTranscriptSegment, setSelectedTranscriptSegment] = useState<
    number | null
  >(null);
  const hasTranscript = recording.transcript.status === 'completed';

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

  const jumpToTranscriptTime = (startTime: number) => {
    setSelectedTranscriptSegment(startTime);
    // This would typically communicate with the video player to seek to the time
    // For now, we'll just update the selected segment
  };

  if (!hasTranscript) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="font-medium text-lg mb-2 text-gray-900">
          No Transcript Available
        </h3>
        <p className="text-sm text-gray-600 mb-4 max-w-sm">
          Generate a transcript to see the conversation details and navigate
          through the recording
        </p>
        <Button
          onClick={() => onStartProcessing(recording, 'transcript')}
          size="sm"
        >
          <FileText className="h-4 w-4 mr-2" />
          Generate Transcript
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <h3 className="font-semibold text-lg text-gray-900">Transcript</h3>
        <Button
          size="sm"
          onClick={() => onDownloadTranscript(recording)}
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>

      {/* Transcript Content */}
      <ScrollArea className="h-96 lg:h-[calc(100vh-300px)]">
        {recording.transcript.segments ? (
          <div className="space-y-3 pr-4">
            {recording.transcript.segments.map((segment, index) => (
              <div
                key={index}
                className={cn(
                  'p-3 rounded-lg cursor-pointer transition-colors border',
                  selectedTranscriptSegment === segment.startTime
                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-100'
                )}
                onClick={() => jumpToTranscriptTime(segment.startTime)}
              >
                <div className="flex items-start gap-3">
                  <div className="text-xs text-blue-600 font-medium min-w-0 bg-blue-100 px-2 py-1 rounded">
                    {formatTime(segment.startTime)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium mb-1 text-gray-900">
                      {segment.speaker}
                    </div>
                    <div className="text-sm text-gray-700 leading-relaxed">
                      {segment.text}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-600 leading-relaxed">
            {recording.transcript.text}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
