import { useState, useCallback, useEffect, useRef } from 'react';
import { useRoom } from '@/contexts/room-context';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import api from '@/lib/axios';
import { SOCKET_EVENTS, RECORDING_STATUSES } from '@/lib/constants';


export interface RecordingState {
  isRecording: boolean;
  recordingId: string | null;
  startedAt: Date | null;
  startedBy: string | null;
  duration: number;
  status: 'idle' | 'starting' | 'recording' | 'stopping' | 'processing' | 'error';
  error: string | null;
}

export interface UseRecordingReturn {
  recordingState: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  canRecord: boolean;
}

const initialState: RecordingState = {
  isRecording: false,
  recordingId: null,
  startedAt: null,
  startedBy: null,
  duration: 0,
  status: RECORDING_STATUSES.IDLE,
  error: null,
};

export const useRecording = (roomId: string | undefined): UseRecordingReturn => {
  const { socket } = useRoom();
  const { toast } = useToast();
  const { user } = useAuth();
  const [recordingState, setRecordingState] = useState<RecordingState>(initialState);
  const [isHost, setIsHost] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch room info to determine host status
  useEffect(() => {
    if (!roomId || !user?.id) return;

    api.get(`/api/rooms/${roomId}`)
      .then((res) => {
        const roomData = res.data?.data || res.data;
        const createdBy = roomData?.createdBy;
        const userRole = user?.role;
        // Host if: created this room, or is an org admin/owner
        const hostStatus =
          (createdBy && createdBy === user.id) ||
          userRole === 'owner' ||
          userRole === 'admin';
        setIsHost(!!hostStatus);
      })
      .catch(() => {
        // If we can't fetch room (e.g. cross-org access denied), conservatively deny host
        setIsHost(false);
      });
  }, [roomId, user?.id, user?.role]);

  // Update duration every second while recording
  useEffect(() => {
    if (recordingState.isRecording && recordingState.startedAt) {
      durationIntervalRef.current = setInterval(() => {
        setRecordingState((prev) => ({
          ...prev,
          duration: Math.round((Date.now() - (prev.startedAt?.getTime() || Date.now())) / 1000),
        }));
      }, 1000);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [recordingState.isRecording, recordingState.startedAt]);

  // Listen for recording events from server
  useEffect(() => {
    if (!socket) return;

    const handleRecordingStarted = (data: { recordingId: string; startedBy: string; startedAt: string }) => {
      setRecordingState({
        isRecording: true,
        recordingId: data.recordingId,
        startedAt: new Date(data.startedAt),
        startedBy: data.startedBy,
        duration: 0,
        status: RECORDING_STATUSES.RECORDING,
        error: null,
      });

      toast({
        title: 'Recording Started',
        description: 'This meeting is now being recorded.',
      });
    };

    const handleRecordingStopped = (data: { recordingId: string; stoppedBy: string; duration: number }) => {
      setRecordingState((prev) => ({
        ...prev,
        isRecording: false,
        status: RECORDING_STATUSES.PROCESSING,
        duration: data.duration,
      }));

      toast({
        title: 'Recording Stopped',
        description: `Recording saved (${formatDuration(data.duration)})`,
      });

      // Reset to idle after processing
      setTimeout(() => {
        setRecordingState(initialState);
      }, 3000);
    };

    const handleRecordingFinalized = (data: { recordingId: string; fileName: string; fileSize: number }) => {
      toast({
        title: 'Recording Saved',
        description: 'Your recording has been saved and is being processed.',
      });

      setRecordingState(initialState);
    };

    const handleRecordingError = (data: { error: string }) => {
      setRecordingState((prev) => ({
        ...prev,
        status: SOCKET_EVENTS.ERROR,
        error: data.error,
        isRecording: false,
      }));

      toast({
        variant: 'destructive',
        title: 'Recording Error',
        description: data.error,
      });
    };

    socket.on(SOCKET_EVENTS.RECORDING_STARTED, handleRecordingStarted);
    socket.on(SOCKET_EVENTS.RECORDING_STOPPED, handleRecordingStopped);
    socket.on(SOCKET_EVENTS.RECORDING_FINALIZED, handleRecordingFinalized);
    socket.on(SOCKET_EVENTS.RECORDING_START_ERROR, handleRecordingError);
    socket.on(SOCKET_EVENTS.RECORDING_STOP_ERROR, handleRecordingError);

    // Request current recording status when joining
    socket.emit(SOCKET_EVENTS.RECORDING_STATUS, { roomId });

    return () => {
      socket.off(SOCKET_EVENTS.RECORDING_STARTED, handleRecordingStarted);
      socket.off(SOCKET_EVENTS.RECORDING_STOPPED, handleRecordingStopped);
      socket.off(SOCKET_EVENTS.RECORDING_FINALIZED, handleRecordingFinalized);
      socket.off(SOCKET_EVENTS.RECORDING_START_ERROR, handleRecordingError);
      socket.off(SOCKET_EVENTS.RECORDING_STOP_ERROR, handleRecordingError);
    };
  }, [socket, roomId, toast]);

  // Handle status response
  useEffect(() => {
    if (!socket) return;

    const handleStatus = (data: {
      isRecording: boolean;
      recordingId?: string;
      startedAt?: string;
      startedBy?: string;
      duration?: number;
      status: string;
    }) => {
      if (data.isRecording) {
        setRecordingState({
          isRecording: true,
          recordingId: data.recordingId || null,
          startedAt: data.startedAt ? new Date(data.startedAt) : null,
          startedBy: data.startedBy || null,
          duration: data.duration || 0,
          status: RECORDING_STATUSES.RECORDING,
          error: null,
        });
      }
    };

    socket.on(SOCKET_EVENTS.RECORDING_STATUS, handleStatus);

    return () => {
      socket.off(SOCKET_EVENTS.RECORDING_STATUS, handleStatus);
    };
  }, [socket]);

  const startRecording = useCallback(async () => {
    if (!socket || !roomId) return;

    try {
      setRecordingState((prev) => ({ ...prev, status: RECORDING_STATUSES.STARTING }));

      // Start server-side tracking
      socket.emit(SOCKET_EVENTS.RECORDING_START, { roomId });

      // Start client-side recording using MediaRecorder
      const streams: MediaStream[] = [];

      // Get all video elements in the room
      const videoElements = document.querySelectorAll('video');
      for (const video of videoElements) {
        if (video.srcObject instanceof MediaStream) {
          streams.push(video.srcObject);
        }
      }

      if (streams.length === 0) {
        throw new Error('No media streams available to record');
      }

      // Create a combined stream (use the first stream for now)
      // In production, you'd want to mix multiple streams
      const combinedStream = streams[0];

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000,
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Combine chunks and send to server
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const arrayBuffer = await blob.arrayBuffer();

        socket.emit(SOCKET_EVENTS.RECORDING_FINALIZE, {
          roomId,
          recordingId: recordingState.recordingId,
          recordingData: Array.from(new Uint8Array(arrayBuffer)),
        });

        recordedChunksRef.current = [];
      };

      mediaRecorder.start(5000); // Collect data every 5 seconds
      mediaRecorderRef.current = mediaRecorder;

    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState((prev) => ({
        ...prev,
        status: SOCKET_EVENTS.ERROR,
        error: error instanceof Error ? error.message : 'Failed to start recording',
      }));

      toast({
        variant: 'destructive',
        title: 'Recording Error',
        description: 'Failed to start recording. Please try again.',
      });
    }
  }, [socket, roomId, recordingState.recordingId, toast]);

  const stopRecording = useCallback(async () => {
    if (!socket || !roomId) return;

    try {
      setRecordingState((prev) => ({ ...prev, status: RECORDING_STATUSES.STOPPING }));

      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }

      // Stop server-side tracking
      socket.emit(SOCKET_EVENTS.RECORDING_STOP, { roomId });

    } catch (error) {
      console.error('Failed to stop recording:', error);
      setRecordingState((prev) => ({
        ...prev,
        status: SOCKET_EVENTS.ERROR,
        error: error instanceof Error ? error.message : 'Failed to stop recording',
      }));
    }
  }, [socket, roomId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  return {
    recordingState,
    startRecording,
    stopRecording,
    // canRecord: only true when socket is connected AND user is the room host
    canRecord: !!socket && !!roomId && isHost,
  };
};

// Helper function to format duration
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export { formatDuration };
