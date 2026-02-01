import React from 'react';
import { Circle, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRecording, formatDuration } from '@/hooks/use-recording';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface RecordingControlsProps {
  roomId: string | undefined;
  className?: string;
  variant?: 'default' | 'compact';
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  roomId,
  className,
  variant = 'default',
}) => {
  const { recordingState, startRecording, stopRecording, canRecord } =
    useRecording(roomId);
  const { user } = useAuth();

  const isStarting = recordingState.status === 'starting';
  const isStopping = recordingState.status === 'stopping';
  const isProcessing = recordingState.status === 'processing';
  const isRecording = recordingState.isRecording;
  const isLoading = isStarting || isStopping || isProcessing;

  // Don't show recording controls if socket not connected
  if (!canRecord) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isRecording ? 'destructive' : 'ghost'}
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className={cn(
                'relative',
                isRecording && 'animate-pulse',
                className
              )}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isRecording ? (
                <Square className="h-4 w-4 fill-current" />
              ) : (
                <Circle className="h-5 w-5 text-red-500" />
              )}
              
              {/* Recording indicator dot */}
              {isRecording && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isRecording ? (
              <div className="text-center">
                <p>Stop Recording</p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(recordingState.duration)}
                </p>
              </div>
            ) : (
              'Start Recording'
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isRecording ? (
        <>
          {/* Recording indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-sm font-medium text-red-500">
              REC {formatDuration(recordingState.duration)}
            </span>
          </div>

          {/* Stop button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopRecording}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isStopping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-3.5 w-3.5 fill-current" />
                  )}
                  Stop
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop Recording</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={startRecording}
                disabled={isLoading}
                className="gap-2"
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-red-500" />
                )}
                Record
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start Recording</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" />
          <span className="text-sm font-medium text-yellow-500">
            Processing...
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Recording indicator badge - shows when recording is in progress
 * Can be placed anywhere in the UI to indicate active recording
 */
export const RecordingIndicator: React.FC<{
  roomId: string | undefined;
  className?: string;
}> = ({ roomId, className }) => {
  const { recordingState } = useRecording(roomId);

  if (!recordingState.isRecording) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 bg-red-500/90 rounded-full text-white text-xs font-medium',
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
      </span>
      REC
    </div>
  );
};

export default RecordingControls;

