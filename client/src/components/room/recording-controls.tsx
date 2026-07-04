import React from 'react';
import { Circle, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useRecording, formatDuration } from '@/hooks/use-recording';

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

  const isStarting = recordingState.status === 'starting';
  const isStopping = recordingState.status === 'stopping';
  const isProcessing = recordingState.status === 'processing';
  const isRecording = recordingState.isRecording;
  const isLoading = isStarting || isStopping || isProcessing;

  if (!canRecord) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className={cn(
                'relative inline-flex items-center justify-center rounded-xl h-10 w-10 border transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
                isRecording
                  ? 'bg-rose-600 border-transparent text-white animate-pulse'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800',
                className
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : isRecording ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Circle className="h-4.5 w-4.5 text-red-500 fill-red-500" />
              )}
              {isRecording && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>
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
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-red-500">
              REC {formatDuration(recordingState.duration)}
            </span>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={stopRecording}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all text-xs font-semibold active:scale-[0.97]"
                >
                  {isStopping ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Square className="h-3 w-3 fill-current" />
                  )}
                  Stop
                </button>
              </TooltipTrigger>
              <TooltipContent>Stop Recording</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={startRecording}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-all text-xs font-semibold active:scale-[0.97]"
              >
                {isStarting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-red-500 fill-red-500 animate-pulse" />
                )}
                Record
              </button>
            </TooltipTrigger>
            <TooltipContent>Start Recording</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {isProcessing && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" />
          <span className="text-xs font-semibold text-yellow-500">
            Processing...
          </span>
        </div>
      )}
    </div>
  );
};

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
        'flex items-center gap-1.5 px-2.5 py-1 bg-red-500/90 rounded-full text-white text-[10px] font-bold tracking-wide',
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
      </span>
      REC
    </div>
  );
};

export default RecordingControls;
