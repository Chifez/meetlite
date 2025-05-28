import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
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
import { Mic, MicOff, Video as VideoIcon, VideoOff, Copy } from 'lucide-react';
import { env } from '@/config/env';

type MediaDeviceInfo = {
  deviceId: string;
  kind: string;
  label: string;
};

const Lobby = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);

  const [isValidRoom, setIsValidRoom] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [selectedVideo, setSelectedVideo] = useState<string>('');

  // Verify room exists
  useEffect(() => {
    const checkRoom = async () => {
      try {
        await axios.get(`${env.ROOM_API_URL}/rooms/${roomId}`, {
          headers: getAuthHeaders(),
        });
        setIsValidRoom(true);
      } catch (error) {
        toast.info('Room not found', {
          description:
            "The meeting room does not exist or you don't have access",
        });
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId) {
      checkRoom();
    }
  }, [roomId, getAuthHeaders, navigate, toast]);

  // Get user media and devices
  useEffect(() => {
    if (!isValidRoom) return;

    const getMediaDevices = async () => {
      try {
        // Request permission to access media devices
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();

        const audioInputs = devices
          .filter((device) => device.kind === 'audioinput')
          .map((device) => ({
            deviceId: device.deviceId,
            kind: device.kind,
            label:
              device.label || `Microphone ${device.deviceId.slice(0, 5)}...`,
          }));

        const videoInputs = devices
          .filter((device) => device.kind === 'videoinput')
          .map((device) => ({
            deviceId: device.deviceId,
            kind: device.kind,
            label: device.label || `Camera ${device.deviceId.slice(0, 5)}...`,
          }));

        setAudioDevices(audioInputs);
        setVideoDevices(videoInputs);

        // Set default devices
        if (audioInputs.length) setSelectedAudio(audioInputs[0].deviceId);
        if (videoInputs.length) setSelectedVideo(videoInputs[0].deviceId);
      } catch (error) {
        console.error('Error accessing media devices:', error);
        toast.error('Camera/Microphone Error', {
          description:
            'Could not access your camera or microphone. Please check permissions.',
        });
      }
    };

    getMediaDevices();

    // Cleanup
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isValidRoom, toast]);

  // Toggle audio
  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !audioEnabled;
      });
      setAudioEnabled(!audioEnabled);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !videoEnabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };

  // Change audio device
  const changeAudioDevice = async (deviceId: string) => {
    try {
      if (stream) {
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

        setSelectedAudio(deviceId);
      }
    } catch (error) {
      console.error('Error changing audio device:', error);
      toast.error('Device Error', {
        description: 'Could not switch to the selected microphone.',
      });
    }
  };

  // Change video device
  const changeVideoDevice = async (deviceId: string) => {
    try {
      if (stream) {
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

        setSelectedVideo(deviceId);
      }
    } catch (error) {
      console.error('Error changing video device:', error);
      toast.error('Device Error', {
        description: 'Could not switch to the selected camera.',
      });
    }
  };

  // Join meeting
  const joinMeeting = () => {
    // Store media settings in session storage
    sessionStorage.setItem('meetlite_audio_enabled', String(audioEnabled));
    sessionStorage.setItem('meetlite_video_enabled', String(videoEnabled));
    sessionStorage.setItem('meetlite_audio_device', selectedAudio);
    sessionStorage.setItem('meetlite_video_device', selectedVideo);

    // Navigate to room
    navigate(`/room/${roomId}`);
  };

  // Copy room link
  const copyRoomLink = () => {
    const roomLink = `${window.location.origin}/lobby/${roomId}`;
    navigator.clipboard.writeText(roomLink);
    toast.info('Link copied', {
      description: 'Meeting link copied to clipboard',
    });
  };

  if (isLoading) {
    return (
      <div className="container flex items-center justify-center h-screen">
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
                  !videoEnabled ? 'hidden' : ''
                }`}
              />

              {!videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <VideoOff className="h-12 w-12 text-muted-foreground" />
                </div>
              )}

              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${
                    !audioEnabled
                      ? 'bg-destructive text-destructive-foreground'
                      : ''
                  }`}
                  onClick={toggleAudio}
                >
                  {audioEnabled ? (
                    <Mic className="h-5 w-5" />
                  ) : (
                    <MicOff className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full ${
                    !videoEnabled
                      ? 'bg-destructive text-destructive-foreground'
                      : ''
                  }`}
                  onClick={toggleVideo}
                >
                  {videoEnabled ? (
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
              <Select value={selectedVideo} onValueChange={changeVideoDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {videoDevices.map((device) => (
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
              <Select value={selectedAudio} onValueChange={changeAudioDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {audioDevices.map((device) => (
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
