import React from 'react';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { FileText, Brain } from 'lucide-react';
import type { MeetingRecording } from '@/types/meetingAssets';

interface RecordingMetadataProps {
  recording: MeetingRecording;
}

export const RecordingMetadata: React.FC<RecordingMetadataProps> = ({
  recording,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-2">
      {/* Status Badges */}
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="text-xs">
          {recording.recording.quality}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {recording.recording.format.toUpperCase()}
        </Badge>
        <Badge
          className={cn('text-xs', getStatusColor(recording.processingStatus))}
        >
          {recording.processingStatus}
        </Badge>
      </div>

      {/* Transcript & Summary Status */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          <span>{recording.transcript.status}</span>
        </div>
        <div className="flex items-center gap-1">
          <Brain className="w-3 h-3" />
          <span>{recording.aiSummary.status}</span>
        </div>
      </div>
    </div>
  );
};
