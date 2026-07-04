import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Copy,
  Loader2,
} from 'lucide-react';

type MediaDeviceInfo = {
  deviceId: string;
  kind: string;
  label: string;
};

const Lobby = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Consolidated state
  const [isLoading, setIsLoading] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [mediaState, setMediaState] = useState({
    audioEnabled: true,
    videoEnabled: true,
  });

  const [devices, setDevices] = useState<{
    audio: MediaDeviceInfo[];
    video: MediaDeviceInfo[];
  }>({
    audio: [],
    video: [],
  });

  const [selectedDevices, setSelectedDevices] = useState({
    audio: '',
    video: '',
  });

  const initializeLobby = useCallback(async () => {
    if (!roomId) return;

    try {
      // Authorization check - ProtectedRoute ensures user is authenticated
      // This API call will return 403 if user doesn't have access
      await api.get(`/api/rooms/${roomId}`);

      // Additional check: verify user has access to the meeting
      // This is a basic check - in a real implementation, you might want to
      // store meeting-room associations and check against those

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        const deviceList = await navigator.mediaDevices.enumerateDevices();

        const audioInputs = deviceList
          .filter((device) => device.kind === 'audioinput')
          .map((device) => ({
            deviceId: device.deviceId,
            kind: device.kind,
            label:
              device.label || `Microphone ${device.deviceId.slice(0, 5)}...`,
          }));

        const videoInputs = deviceList
          .filter((device) => device.kind === 'videoinput')
          .map((device) => ({
            deviceId: device.deviceId,
            kind: device.kind,
            label: device.label || `Camera ${device.deviceId.slice(0, 5)}...`,
          }));

        const defaultAudio =
          audioInputs.length > 0 ? audioInputs[0].deviceId : '';
        const defaultVideo =
          videoInputs.length > 0 ? videoInputs[0].deviceId : '';

        setStream(mediaStream);
        setDevices({ audio: audioInputs, video: videoInputs });
        setSelectedDevices({ audio: defaultAudio, video: defaultVideo });

        // Set video element source
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (mediaError) {
        console.error('Error accessing media devices:', mediaError);
        toast.error('Camera/Microphone Error', {
          description:
            'Could not access your camera or microphone. Please check permissions.',
        });
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('Access Denied', {
          description: 'You do not have permission to join this meeting room.',
        });
      } else {
        toast.info('Room not found', {
          description:
            "The meeting room does not exist or you don't have access",
        });
      }
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeLobby();
  }, [initializeLobby]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Media control functions
  const toggleAudio = () => {
    if (!stream) return;
    const newAudioEnabled = !mediaState.audioEnabled;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = newAudioEnabled;
    });
    setMediaState((prev) => ({ ...prev, audioEnabled: newAudioEnabled }));
  };

  const toggleVideo = () => {
    if (!stream) return;
    const newVideoEnabled = !mediaState.videoEnabled;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = newVideoEnabled;
    });
    setMediaState((prev) => ({ ...prev, videoEnabled: newVideoEnabled }));
  };

  const changeAudioDevice = async (deviceId: string) => {
    if (!stream) return;
    try {
      // Stop current audio tracks
      stream.getAudioTracks().forEach((track) => track.stop());

      // Get new audio track
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });

      // Add new audio track to existing stream
      const newAudioTrack = newStream.getAudioTracks()[0];
      if (newAudioTrack) {
        stream.addTrack(newAudioTrack);
      }

      setSelectedDevices((prev) => ({ ...prev, audio: deviceId }));
    } catch (error) {
      console.error('Error changing audio device:', error);
      toast.error('Device Error', {
        description: 'Could not switch to the selected microphone.',
      });
    }
  };

  const changeVideoDevice = async (deviceId: string) => {
    if (!stream) return;
    try {
      // Stop current video tracks
      stream.getVideoTracks().forEach((track) => track.stop());

      // Get new video track
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        stream.addTrack(newVideoTrack);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }

      setSelectedDevices((prev) => ({ ...prev, video: deviceId }));
    } catch (error) {
      console.error('Error changing video device:', error);
      toast.error('Device Error', {
        description: 'Could not switch to the selected camera.',
      });
    }
  };

  const joinMeeting = () => {
    // Store media settings in session storage
    sessionStorage.setItem(
      'meetlite_audio_enabled',
      String(mediaState.audioEnabled)
    );
    sessionStorage.setItem(
      'meetlite_video_enabled',
      String(mediaState.videoEnabled)
    );
    sessionStorage.setItem('meetlite_audio_device', selectedDevices.audio);
    sessionStorage.setItem('meetlite_video_device', selectedDevices.video);

    // Navigate to room
    navigate(`/room/${roomId}`);
  };

  const copyRoomLink = () => {
    const roomLink = `${window.location.origin}/lobby/${roomId}`;
    navigator.clipboard.writeText(roomLink);
    toast.info('Link copied', {
      description: 'Meeting link copied to clipboard',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        <p className="text-[0.875rem] text-muted-foreground">Setting up your devices…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="absolute top-[-20%] left-[20%] w-[700px] h-[700px] rounded-full bg-primary/5 blur-[140px] pointer-events-none" aria-hidden="true" />

      <div className="relative w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em]">Ready to join?</h1>
          <p className="text-[0.8125rem] text-muted-foreground mt-1">
            Adjust your camera and microphone before entering the room.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Video preview */}
          <div className="space-y-3">
            <div className="relative w-full aspect-video bg-muted rounded-2xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${!mediaState.videoEnabled ? 'hidden' : ''}`}
              />

              {!mediaState.videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <VideoOff className="w-10 h-10 text-muted-foreground/50" />
                </div>
              )}

              {/* Toggle controls overlay */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-xl p-1.5">
                <button
                  onClick={toggleAudio}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    !mediaState.audioEnabled
                      ? 'bg-destructive text-white'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {mediaState.audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    !mediaState.videoEnabled
                      ? 'bg-destructive text-white'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {mediaState.videoEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Settings panel */}
          <div className="flex flex-col gap-4">
            {/* Camera select */}
            <div className="space-y-1.5">
              <label className="text-[0.8125rem] font-medium text-foreground">Camera</label>
              <Select value={selectedDevices.video} onValueChange={changeVideoDevice}>
                <SelectTrigger id="lobby-camera-select">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {devices.video.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Microphone select */}
            <div className="space-y-1.5">
              <label className="text-[0.8125rem] font-medium text-foreground">Microphone</label>
              <Select value={selectedDevices.audio} onValueChange={changeAudioDevice}>
                <SelectTrigger id="lobby-mic-select">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {devices.audio.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Room code chip */}
            <div className="flex items-center justify-between border border-border rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] text-muted-foreground font-medium">Room</span>
                <code className="text-[0.8125rem] font-mono font-semibold text-foreground">{roomId}</code>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={copyRoomLink} title="Copy meeting link">
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Join CTA */}
            <Button
              id="lobby-join-btn"
              size="lg"
              className="w-full rounded-xl font-semibold mt-auto"
              onClick={joinMeeting}
            >
              Join room
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
