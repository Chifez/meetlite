import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { env } from '@/config/env';

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
      await api.get(`${env.ROOM_API_URL}/rooms/${roomId}`);

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
      <div className="container flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Meeting Lobby</CardTitle>
          <CardDescription>
            Preview your camera and microphone before joining
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-md h-64 md:h-80 bg-muted rounded-lg overflow-hidden mb-4">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${
                  !mediaState.videoEnabled ? 'hidden' : ''
                }`}
              />

              {!mediaState.videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <VideoOff className="h-12 w-12 text-muted-foreground" />
                </div>
              )}

              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${
                    !mediaState.audioEnabled
                      ? 'bg-destructive text-destructive-foreground'
                      : ''
                  }`}
                  onClick={toggleAudio}
                >
                  {mediaState.audioEnabled ? (
                    <Mic className="h-5 w-5" />
                  ) : (
                    <MicOff className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${
                    !mediaState.videoEnabled
                      ? 'bg-destructive text-destructive-foreground'
                      : ''
                  }`}
                  onClick={toggleVideo}
                >
                  {mediaState.videoEnabled ? (
                    <VideoIcon className="h-5 w-5" />
                  ) : (
                    <VideoOff className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Camera</label>
              <Select
                value={selectedDevices.video}
                onValueChange={changeVideoDevice}
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Microphone</label>
              <Select
                value={selectedDevices.audio}
                onValueChange={changeAudioDevice}
              >
                <SelectTrigger>
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
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Room Code:</span>
              <code className="px-2 py-1 bg-background rounded text-sm">
                {roomId}
              </code>
            </div>
            <Button variant="outline" size="sm" onClick={copyRoomLink}>
              <Copy className="h-4 w-4 mr-2" /> Copy Link
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={joinMeeting} size="lg">
            Join Meeting
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Lobby;
