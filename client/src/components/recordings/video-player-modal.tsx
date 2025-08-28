import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Download,
  FileText,
  Brain,
  Users,
  MessageSquare,
  Clock,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { MeetingRecording } from '../../services/meetingAssetsService';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTranscriptSegment, setSelectedTranscriptSegment] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!recording || !open) return;

    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [recording, open]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = time;
    setCurrentTime(time);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
  };

  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    video.currentTime = newTime;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
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

  const getParticipantInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const jumpToTranscriptTime = (startTime: number) => {
    handleSeek(startTime);
    setSelectedTranscriptSegment(startTime);
  };

  if (!recording) return null;

  const hasTranscript = recording.transcript.status === 'completed';
  const hasSummary = recording.aiSummary.status === 'completed';
  const videoUrl = streamingUrl || recording.recording.streamingUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
          {/* Video Player Section */}
          <div className="lg:col-span-2 bg-black relative">
            <DialogHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
              <DialogTitle className="text-white text-lg">
                {recording.title}
              </DialogTitle>
              <p className="text-gray-300 text-sm">
                {format(new Date(recording.createdAt), 'MMM d, yyyy • h:mm a')}
              </p>
            </DialogHeader>

            {/* Video Element */}
            <div className="relative w-full h-full flex items-center justify-center">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}

              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                poster={recording.recording.thumbnailUrl}
                preload="metadata"
              />

              {/* Video Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="relative bg-white/20 rounded-full h-1 cursor-pointer">
                    <div
                      className="absolute top-0 left-0 bg-blue-500 rounded-full h-1"
                      style={{
                        width: `${
                          duration ? (currentTime / duration) * 100 : 0
                        }%`,
                      }}
                    />
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      value={currentTime}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => skipTime(-10)}
                      className="text-white hover:bg-white/20"
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={togglePlay}
                      className="text-white hover:bg-white/20"
                    >
                      {isPlaying ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => skipTime(10)}
                      className="text-white hover:bg-white/20"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleMute}
                        className="text-white hover:bg-white/20"
                      >
                        {isMuted ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={(e) =>
                          handleVolumeChange(Number(e.target.value))
                        }
                        className="w-16"
                      />
                    </div>

                    <span className="text-white text-sm ml-4">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFullscreen}
                    className="text-white hover:bg-white/20"
                  >
                    {isFullscreen ? (
                      <Minimize className="h-4 w-4" />
                    ) : (
                      <Maximize className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Info Panel Section */}
          <div className="bg-white">
            <Tabs defaultValue="info" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
              </TabsList>

              {/* Info Tab */}
              <TabsContent value="info" className="flex-1 p-4 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Recording Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span>{formatTime(recording.recording.duration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quality:</span>
                      <span>{recording.recording.quality}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Format:</span>
                      <span>{recording.recording.format.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Views:</span>
                      <span>{recording.analytics.viewCount}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">
                    Participants ({recording.participants.length})
                  </h3>
                  <ScrollArea className="h-40">
                    <div className="space-y-2">
                      {recording.participants.map((participant, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                              {getParticipantInitials(participant.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {participant.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {participant.role}
                            </p>
                          </div>
                          {participant.speakingTime && (
                            <div className="text-xs text-gray-500">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatTime(participant.speakingTime)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {recording.tags.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {recording.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-4 border-t">
                  <Button
                    onClick={() => onDownloadTranscript(recording)}
                    disabled={!hasTranscript}
                    className="w-full"
                    variant={hasTranscript ? 'default' : 'outline'}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {hasTranscript
                      ? 'Download Transcript'
                      : 'Generate Transcript'}
                  </Button>

                  {!hasTranscript && (
                    <Button
                      onClick={() => onStartProcessing(recording, 'transcript')}
                      variant="outline"
                      className="w-full"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Start Transcription
                    </Button>
                  )}
                </div>
              </TabsContent>

              {/* Transcript Tab */}
              <TabsContent value="transcript" className="flex-1 p-4">
                {hasTranscript ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Transcript</h3>
                      <Button
                        size="sm"
                        onClick={() => onDownloadTranscript(recording)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>

                    <ScrollArea className="h-96">
                      {recording.transcript.segments ? (
                        <div className="space-y-3">
                          {recording.transcript.segments.map(
                            (segment, index) => (
                              <div
                                key={index}
                                className={cn(
                                  'p-3 rounded-lg cursor-pointer transition-colors',
                                  selectedTranscriptSegment ===
                                    segment.startTime
                                    ? 'bg-blue-100 border-blue-200'
                                    : 'bg-gray-50 hover:bg-gray-100'
                                )}
                                onClick={() =>
                                  jumpToTranscriptTime(segment.startTime)
                                }
                              >
                                <div className="flex items-start gap-3">
                                  <div className="text-xs text-blue-600 font-medium min-w-0">
                                    {formatTime(segment.startTime)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium mb-1">
                                      {segment.speaker}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                      {segment.text}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">
                          {recording.transcript.text}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="font-medium mb-2">
                      No Transcript Available
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Generate a transcript to see the conversation details
                    </p>
                    <Button
                      onClick={() => onStartProcessing(recording, 'transcript')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Transcript
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Summary Tab */}
              <TabsContent value="summary" className="flex-1 p-4">
                {hasSummary ? (
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold mb-2">Summary</h3>
                        <p className="text-sm text-gray-700">
                          {recording.aiSummary.summary}
                        </p>
                      </div>

                      {recording.aiSummary.keyPoints.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-2">Key Points</h3>
                          <ul className="space-y-1">
                            {recording.aiSummary.keyPoints.map(
                              (point, index) => (
                                <li
                                  key={index}
                                  className="text-sm text-gray-700"
                                >
                                  • {point}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                      {recording.aiSummary.actionItems.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-2">Action Items</h3>
                          <div className="space-y-2">
                            {recording.aiSummary.actionItems.map(
                              (item, index) => (
                                <div
                                  key={index}
                                  className="p-2 bg-yellow-50 rounded border-l-4 border-yellow-400"
                                >
                                  <div className="text-sm font-medium">
                                    {item.task}
                                  </div>
                                  {item.assignee && (
                                    <div className="text-xs text-gray-600">
                                      Assigned to: {item.assignee}
                                    </div>
                                  )}
                                  {item.dueDate && (
                                    <div className="text-xs text-gray-600">
                                      Due:{' '}
                                      {format(new Date(item.dueDate), 'PPP')}
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {recording.aiSummary.topics.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-2">
                            Topics Discussed
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {recording.aiSummary.topics.map((topic, index) => (
                              <Badge key={index} variant="outline">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Brain className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="font-medium mb-2">
                      No AI Summary Available
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Generate an AI summary to get key insights from this
                      meeting
                    </p>
                    <Button
                      onClick={() => onStartProcessing(recording, 'summary')}
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Generate Summary
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
