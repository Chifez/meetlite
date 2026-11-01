import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
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
  Check,
  Loader2,
  Volume2,
  Wifi,
  ChevronDown,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { getInitials } from '@/components/meeting/meeting-details-dialog';

type MediaDeviceInfo = {
  deviceId: string;
  kind: string;
  label: string;
};

export default function Lobby() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const initializationIdRef = useRef(0);

  const [isLoading, setIsLoading] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // User display name
  const [displayName, setDisplayName] = useState(
    () => user?.name || user?.email?.split('@')[0] || ''
  );

  // Media state
  const [mediaState, setMediaState] = useState({
    audioEnabled: true,
    videoEnabled: true,
  });

  // Audio amplitude level (0 to 6)
  const [audioLevel, setAudioLevel] = useState(0);

  // Devices
  const [devices, setDevices] = useState<{
    audio: MediaDeviceInfo[];
    video: MediaDeviceInfo[];
    speaker: MediaDeviceInfo[];
  }>({
    audio: [],
    video: [],
    speaker: [],
  });

  const [selectedDevices, setSelectedDevices] = useState({
    audio: '',
    video: '',
    speaker: '',
  });

  // Room details
  const [roomInfo, setRoomInfo] = useState<{
    title?: string;
    description?: string;
    hostName?: string;
    participantsCount?: number;
    participants?: Array<{ name?: string; email?: string }>;
  }>({});

  const initializeLobby = useCallback(async () => {
    if (!roomId) return;
    const initializationId = ++initializationIdRef.current;

    try {
      const roomRes = await api.get(`/api/rooms/${roomId}`);
      if (initializationId !== initializationIdRef.current) return;

      const roomData = roomRes.data?.data || {};
      setRoomInfo({
        title: roomData.title || roomData.name || 'Meeting',
        description: roomData.description,
        hostName: roomData.host?.name || roomData.host?.email?.split('@')[0],
        participantsCount: roomData.participants?.length || 0,
        participants: roomData.participants || [],
      });

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        const deviceList = await navigator.mediaDevices.enumerateDevices();
        if (initializationId !== initializationIdRef.current) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        const audioInputs = deviceList
          .filter((device) => device.kind === 'audioinput')
          .map((device) => ({
            deviceId: device.deviceId,
            kind: device.kind,
            label: device.label || `Microphone ${device.deviceId.slice(0, 5)}...`,
          }));

        const videoInputs = deviceList
          .filter((device) => device.kind === 'videoinput')
          .map((device) => ({
            deviceId: device.deviceId,
            kind: device.kind,
            label: device.label || `Camera ${device.deviceId.slice(0, 5)}...`,
          }));

        const speakerOutputs = deviceList
          .filter((device) => device.kind === 'audiooutput')
          .map((device) => ({
            deviceId: device.deviceId,
            kind: device.kind,
            label: device.label || `Speaker ${device.deviceId.slice(0, 5)}...`,
          }));

        const defaultAudio = audioInputs.length > 0 ? audioInputs[0].deviceId : '';
        const defaultVideo = videoInputs.length > 0 ? videoInputs[0].deviceId : '';
        const defaultSpeaker = speakerOutputs.length > 0 ? speakerOutputs[0].deviceId : '';

        setStream(mediaStream);
        setDevices({ audio: audioInputs, video: videoInputs, speaker: speakerOutputs });
        setSelectedDevices({
          audio: defaultAudio,
          video: defaultVideo,
          speaker: defaultSpeaker,
        });
      } catch (mediaError) {
        if (initializationId !== initializationIdRef.current) return;
        console.error('Error accessing media devices:', mediaError);
        toast.error('Camera/Microphone Permission', {
          description:
            'Could not access your camera or microphone. You can still join with audio only.',
        });
      }
    } catch (error: any) {
      if (initializationId !== initializationIdRef.current) return;
      const status = error?.response?.status;
      if (status === 403) {
        toast.error('Access Denied', {
          description: 'You do not have permission to join this meeting room.',
        });
      } else {
        toast.info('Room not found', {
          description: "The meeting room does not exist or you don't have access.",
        });
      }
      navigate('/dashboard');
    } finally {
      if (initializationId === initializationIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [navigate, roomId]);

  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = stream;

  useEffect(() => {
    void initializeLobby();
    return () => {
      initializationIdRef.current += 1;
    };
  }, [initializeLobby]);

  // Bind video preview
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || isLoading) return;

    video.srcObject = stream;
    void video.play().catch((error) => {
      console.error('Error starting lobby preview:', error);
    });

    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream, isLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Live Web Audio API Amplitude Visualizer
  useEffect(() => {
    if (!stream || !mediaState.audioEnabled) {
      setAudioLevel(0);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      setAudioLevel(0);
      return;
    }

    let animationFrameId: number;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;

      source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(6, Math.floor((avg / 80) * 6));
        setAudioLevel(normalized);

        animationFrameId = requestAnimationFrame(tick);
      };

      tick();
    } catch (err) {
      console.warn('AudioContext not available for meter:', err);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (source) source.disconnect();
      if (analyser) analyser.disconnect();
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    };
  }, [stream, mediaState.audioEnabled]);

  // Toggle audio
  const toggleAudio = () => {
    if (!stream) return;
    const nextState = !mediaState.audioEnabled;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = nextState;
    });
    setMediaState((prev) => ({ ...prev, audioEnabled: nextState }));
  };

  // Toggle video
  const toggleVideo = () => {
    if (!stream) return;
    const nextState = !mediaState.videoEnabled;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = nextState;
    });
    setMediaState((prev) => ({ ...prev, videoEnabled: nextState }));
  };

  // Change audio input device
  const changeAudioDevice = async (deviceId: string) => {
    if (!stream) return;
    try {
      stream.getAudioTracks().forEach((track) => {
        track.stop();
        stream.removeTrack(track);
      });

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { ideal: deviceId } } : true,
      });

      const newTrack = newStream.getAudioTracks()[0];
      if (newTrack) {
        stream.addTrack(newTrack);
      }
      setSelectedDevices((prev) => ({ ...prev, audio: deviceId }));
    } catch (error) {
      console.error('Error changing audio device:', error);
      toast.error('Device Error', {
        description: 'Could not switch to selected microphone.',
      });
    }
  };

  // Change video input device
  const changeVideoDevice = async (deviceId: string) => {
    if (!stream) return;
    try {
      stream.getVideoTracks().forEach((track) => {
        track.stop();
        stream.removeTrack(track);
      });

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { ideal: deviceId } } : true,
      });

      const newTrack = newStream.getVideoTracks()[0];
      if (newTrack) {
        stream.addTrack(newTrack);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
      setSelectedDevices((prev) => ({ ...prev, video: deviceId }));
    } catch (error) {
      console.error('Error changing camera device:', error);
      toast.error('Device Error', {
        description: 'Could not switch to selected camera.',
      });
    }
  };

  // Join meeting (standard)
  const joinMeeting = () => {
    sessionStorage.setItem('meetlite_audio_enabled', String(mediaState.audioEnabled));
    sessionStorage.setItem('meetlite_video_enabled', String(mediaState.videoEnabled));
    sessionStorage.setItem('meetlite_audio_device', selectedDevices.audio);
    sessionStorage.setItem('meetlite_video_device', selectedDevices.video);
    if (displayName.trim()) {
      sessionStorage.setItem('meetlite_display_name', displayName.trim());
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    navigate(`/room/${roomId}`);
  };

  // Join with audio only
  const joinWithAudioOnly = () => {
    sessionStorage.setItem('meetlite_audio_enabled', 'true');
    sessionStorage.setItem('meetlite_video_enabled', 'false');
    sessionStorage.setItem('meetlite_audio_device', selectedDevices.audio);
    sessionStorage.setItem('meetlite_video_device', '');
    if (displayName.trim()) {
      sessionStorage.setItem('meetlite_display_name', displayName.trim());
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    navigate(`/room/${roomId}`);
  };

  const copyRoomLink = () => {
    const roomLink = `${window.location.origin}/lobby/${roomId}`;
    navigator.clipboard.writeText(roomLink);
    setCopiedLink(true);
    toast.success('Meeting link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-xs text-[#6B6A65] dark:text-muted-foreground">
          Setting up your devices…
        </p>
      </div>
    );
  }

  const userInitial = displayName ? displayName[0].toUpperCase() : 'U';

  const currentMicLabel =
    devices.audio.find((d) => d.deviceId === selectedDevices.audio)?.label ||
    'Default Microphone';
  const currentCameraLabel =
    devices.video.find((d) => d.deviceId === selectedDevices.video)?.label ||
    'Default Camera';
  const currentSpeakerLabel =
    devices.speaker.find((d) => d.deviceId === selectedDevices.speaker)?.label ||
    'Default Speakers';

  return (
    <div className="min-h-screen bg-[#F3F2EE] dark:bg-background flex items-center justify-center p-4 font-sans text-[13px] leading-normal text-foreground">
      {/* Centered Lobby Container */}
      <div className="w-full max-w-3xl bg-[#FBFAF8] dark:bg-card border border-[#DAD7CF] dark:border-border/80 rounded-[14px] shadow-xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#E2DFD7] dark:border-border/80 bg-white/50 dark:bg-card">
          <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <VideoIcon className="w-3.5 h-3.5" />
          </div>
          <b className="font-medium text-sm text-foreground flex-1">
            MeetLite
          </b>
          <span className="text-[11px] text-[#6B6A65] dark:text-muted-foreground inline-flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-[#1D9E75]" />
            <span>Connection is good</span>
          </span>
        </div>

        {/* 2-Column Desktop Grid (Stacks on mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5 p-5 items-start">
          {/* Left Column: Preview & Live Mic Visualizer */}
          <div className="space-y-3">
            <div className="relative bg-[#2B2B29] rounded-[14px] aspect-[16/10] flex items-center justify-center overflow-hidden shadow-inner">
              <video
                ref={videoRef}
                data-testid="lobby-video-preview"
                autoPlay
                muted
                playsInline
                className={cn(
                  'w-full h-full object-cover',
                  !mediaState.videoEnabled && 'hidden'
                )}
              />

              {/* Camera Off Placeholder */}
              {!mediaState.videoEnabled && (
                <div className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-medium shadow-md">
                  {userInitial}
                </div>
              )}

              {/* Top-Left Camera Status Badge */}
              {!mediaState.videoEnabled && (
                <div className="absolute left-3 top-3 bg-black/55 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-md font-medium">
                  Camera is off
                </div>
              )}

              {/* Floating Camera & Mic Controls */}
              <div className="absolute left-0 right-0 bottom-3 flex justify-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleAudio}
                  aria-label={mediaState.audioEnabled ? 'Mute' : 'Unmute'}
                  className={cn(
                    'w-9.5 h-9.5 rounded-full flex items-center justify-center text-base transition-all shadow-sm focus:outline-none',
                    mediaState.audioEnabled
                      ? 'bg-white/20 text-white hover:bg-white/30 border border-white/25'
                      : 'bg-[#E24B4A] text-white hover:bg-[#E24B4A]/90 border border-[#E24B4A]'
                  )}
                >
                  {mediaState.audioEnabled ? (
                    <Mic className="w-4.5 h-4.5" />
                  ) : (
                    <MicOff className="w-4.5 h-4.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={toggleVideo}
                  aria-label={mediaState.videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  className={cn(
                    'w-9.5 h-9.5 rounded-full flex items-center justify-center text-base transition-all shadow-sm focus:outline-none',
                    mediaState.videoEnabled
                      ? 'bg-white/20 text-white hover:bg-white/30 border border-white/25'
                      : 'bg-[#E24B4A] text-white hover:bg-[#E24B4A]/90 border border-[#E24B4A]'
                  )}
                >
                  {mediaState.videoEnabled ? (
                    <VideoIcon className="w-4.5 h-4.5" />
                  ) : (
                    <VideoOff className="w-4.5 h-4.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Live Web Audio Amplitude Meter */}
            <div className="flex items-center gap-2.5 px-1">
              <Mic className="w-4 h-4 text-[#6B6A65] dark:text-muted-foreground shrink-0" />
              <div className="flex-1 flex gap-1 items-center h-2">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const isActive = mediaState.audioEnabled && audioLevel > idx;
                  return (
                    <span
                      key={idx}
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors duration-75',
                        isActive
                          ? 'bg-[#1D9E75]'
                          : 'bg-[#DAD7CF] dark:bg-muted'
                      )}
                    />
                  );
                })}
              </div>
              <span className="text-[11px] text-[#6B6A65] dark:text-muted-foreground whitespace-nowrap">
                {mediaState.audioEnabled ? 'Speak to test your mic' : 'Mic is muted'}
              </span>
            </div>
          </div>

          {/* Right Column: Settings & Decisions */}
          <div className="flex flex-col gap-3">
            {/* Meeting Header */}
            <div>
              <h1 className="text-base font-medium text-foreground tracking-tight">
                {roomInfo.title || 'Meeting Room'}
              </h1>
              <div className="text-[11px] text-[#6B6A65] dark:text-muted-foreground mt-0.5">
                Room <code className="font-mono text-foreground font-semibold">{roomId}</code>
                {roomInfo.hostName && ` · Hosted by ${roomInfo.hostName}`}
              </div>

              {/* Room Presence */}
              <div className="flex items-center gap-2 mt-2">
                {roomInfo.participantsCount && roomInfo.participantsCount > 0 ? (
                  <>
                    <div className="flex -space-x-1.5 shrink-0">
                      {roomInfo.participants?.slice(0, 3).map((p, idx) => (
                        <div
                          key={idx}
                          className="w-5.5 h-5.5 rounded-full border border-[#FBFAF8] dark:border-card bg-[#E1F5EE] text-[#085041] text-[10px] font-medium flex items-center justify-center"
                        >
                          {getInitials(p.name || p.email)}
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] text-[#6B6A65] dark:text-muted-foreground">
                      {roomInfo.participantsCount} {roomInfo.participantsCount === 1 ? 'person is' : 'people are'} in this meeting
                    </span>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] text-[#6B6A65] dark:text-muted-foreground">
                      You're the first one here
                    </span>
                    <button
                      type="button"
                      onClick={copyRoomLink}
                      className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 focus:outline-none"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Copied' : 'Copy link'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Your Name */}
            <div>
              <label
                htmlFor="lobby-name"
                className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90 block mb-1"
              >
                Your name
              </label>
              <input
                id="lobby-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                className="w-full h-9 bg-white dark:bg-background border border-[#CFCCC3] dark:border-border/80 rounded-lg px-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Grouped Devices Card */}
            <div>
              <label className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90 block mb-1">
                Devices
              </label>
              <div className="bg-white dark:bg-background border border-[#DAD7CF] dark:border-border/80 rounded-[10px] overflow-hidden divide-y divide-[#E8E5DE] dark:divide-border/60">
                {/* Microphone Select */}
                <div className="flex items-center gap-2.5 p-2 px-3">
                  <Mic className="w-4 h-4 text-[#6B6A65] dark:text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Select
                      value={selectedDevices.audio}
                      onValueChange={changeAudioDevice}
                    >
                      <SelectTrigger
                        id="lobby-mic-select"
                        className="h-6 border-none p-0 text-xs shadow-none hover:bg-transparent focus:ring-0"
                      >
                        <SelectValue placeholder={currentMicLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.audio.map((d) => (
                          <SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Camera Select */}
                <div className="flex items-center gap-2.5 p-2 px-3">
                  <VideoIcon className="w-4 h-4 text-[#6B6A65] dark:text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Select
                      value={selectedDevices.video}
                      onValueChange={changeVideoDevice}
                    >
                      <SelectTrigger
                        id="lobby-camera-select"
                        className="h-6 border-none p-0 text-xs shadow-none hover:bg-transparent focus:ring-0"
                      >
                        <SelectValue placeholder={currentCameraLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.video.map((d) => (
                          <SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Speakers Select */}
                <div className="flex items-center gap-2.5 p-2 px-3">
                  <Volume2 className="w-4 h-4 text-[#6B6A65] dark:text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Select
                      value={selectedDevices.speaker}
                      onValueChange={(val) =>
                        setSelectedDevices((prev) => ({ ...prev, speaker: val }))
                      }
                    >
                      <SelectTrigger
                        id="lobby-speaker-select"
                        className="h-6 border-none p-0 text-xs shadow-none hover:bg-transparent focus:ring-0"
                      >
                        <SelectValue placeholder={currentSpeakerLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.speaker.length > 0 ? (
                          devices.speaker.map((d) => (
                            <SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
                              {d.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="default" className="text-xs">
                            System Default Speaker
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Join Actions */}
            <div className="flex flex-col gap-2 pt-1">
              <Button
                id="lobby-join-btn"
                type="button"
                onClick={joinMeeting}
                className="w-full h-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-xs"
              >
                Join now
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={joinWithAudioOnly}
                className="w-full h-8.5 rounded-lg border-[#CFCCC3] dark:border-border/80 bg-white dark:bg-background text-xs font-medium hover:bg-secondary/40"
              >
                Join with audio only
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
