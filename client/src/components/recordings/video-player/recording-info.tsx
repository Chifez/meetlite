import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { FileText } from 'lucide-react';
import type { MeetingRecording } from '@/types/meetingAssets';
import { hasValidTags, getValidTags } from '@/utils/tags';

interface RecordingInfoProps {
  recording: MeetingRecording;
  onDownloadTranscript: (recording: MeetingRecording) => void;
  onStartProcessing: (
    recording: MeetingRecording,
    type: 'transcript' | 'summary' | 'both'
  ) => void;
}

export const RecordingInfo: React.FC<RecordingInfoProps> = ({
  recording,
  onDownloadTranscript,
  onStartProcessing,
}) => {
  const hasTranscript = recording.transcript.status === 'completed';

  const getParticipantInitials = (name: string): string => {
    if (!name || typeof name !== 'string') {
      return '??';
    }
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
    <div className="space-y-">
      {/* Recording Details */}
      <div>
        <h3 className="font-semibold text-lg mb-3 text-gray-900">
          Recording Details
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600 font-medium">Duration:</span>
            <span className="font-mono text-gray-900">
              {formatTime(recording.recording.duration)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600 font-medium">Quality:</span>
            <span className="text-gray-900">{recording.recording.quality}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600 font-medium">Format:</span>
            <span className="text-gray-900 font-mono">
              {recording.recording.format.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600 font-medium">Views:</span>
            <span className="text-gray-900">
              {recording.analytics.viewCount}
            </span>
          </div>
        </div>
      </div>

      {/* Participants */}
      <div>
        <h3 className="font-semibold text-lg mb-3 text-gray-900">
          Participants ({recording.participants.length})
        </h3>
        <div className="space-y-3 max-h-48 overflow-y-auto">
          {recording.participants.map((participant, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                  {getParticipantInitials(
                    participant.name ||
                      participant.email ||
                      `Participant ${index + 1}`
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {participant.name ||
                    participant.email ||
                    `Participant ${index + 1}`}
                </p>
                <p className="text-xs text-gray-500">
                  {participant.role || 'Participant'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      {hasValidTags(recording.tags) && (
        <div>
          <h3 className="font-semibold text-lg mb-3 text-gray-900">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {getValidTags(recording.tags).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-4 border-t border-gray-200">
        <Button
          onClick={() => onDownloadTranscript(recording)}
          disabled={!hasTranscript}
          className="w-full"
          variant={hasTranscript ? 'default' : 'outline'}
          size="sm"
        >
          <FileText className="h-4 w-4 mr-2" />
          {hasTranscript ? 'Download Transcript' : 'Generate Transcript'}
        </Button>

        {!hasTranscript && (
          <Button
            onClick={() => onStartProcessing(recording, 'transcript')}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <FileText className="h-4 w-4 mr-2" />
            Start Transcription
          </Button>
        )}
      </div>
    </div>
  );
};
