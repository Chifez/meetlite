import React, { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Play,
  Download,
  FileText,
  Brain,
  MoreVertical,
  Edit3,
  Trash2,
  Eye,
  Clock,
  Users,
  Tag,
  Share2,
  Loader2,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingRecording } from '../../services/meetingAssetsService';
import VideoHeader from './video-player/video-header';

interface RecordingCardProps {
  recording: MeetingRecording;
  onPlay: (recording: MeetingRecording) => void;
  onEdit: (recording: MeetingRecording) => void;
  onDelete: (recording: MeetingRecording) => void;
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
  onDownloadTranscript,
  onStartProcessing,
  onShare,
  isProcessing = false,
  processingProgress = 0,
  className,
}) => {
  const [thumbnailError, setThumbnailError] = useState(false);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
          setThumbnailError={setThumbnailError}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onPlay(recording)}>
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(recording)}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShare(recording)}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDownloadTranscript(recording)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Download Transcript
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onStartProcessing(recording, 'transcript')}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Generate Transcript
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onStartProcessing(recording, 'summary')}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Generate Summary
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(recording)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-3">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">
              {recording.recording.quality}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {recording.recording.format.toUpperCase()}
            </Badge>
            <Badge
              className={cn(
                'text-xs',
                getStatusColor(recording.processingStatus)
              )}
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

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>
                {format(new Date(recording.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{recording.participants.length}</span>
            </div>
          </div>

          {/* Tags */}
          {recording.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recording.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {recording.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{recording.tags.length - 3}
                </Badge>
              )}
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
