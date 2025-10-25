import React from 'react';
import { format } from 'date-fns';
import { Clock, Users, Eye, Download } from 'lucide-react';
import type { MeetingRecording } from '@/types/meetingAssets';

interface RecordingStatsProps {
  recording: MeetingRecording;
}

export const RecordingStats: React.FC<RecordingStatsProps> = ({
  recording,
}) => {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        <span>{format(new Date(recording.createdAt), 'MMM d, yyyy')}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>{recording.participants.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="w-3 h-3" />
          <span>{recording.analytics.viewCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          <span>{recording.analytics.downloadCount}</span>
        </div>
      </div>
    </div>
  );
};
