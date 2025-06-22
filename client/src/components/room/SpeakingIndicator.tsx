import { useEffect, useState, useRef } from 'react';
import { Mic } from 'lucide-react';

interface SpeakingIndicatorProps {
  stream: MediaStream | null;
  isLocal?: boolean;
  audioEnabled?: boolean;
}

export const SpeakingIndicator = ({
  stream,
  isLocal = false,
  audioEnabled = true,
}: SpeakingIndicatorProps) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    // Handle case where stream is not available or audio is disabled
    if (!stream || !audioEnabled) {
      setIsSpeaking(false);
      setAudioLevel(0);

      // Cleanup if needed
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }

      return;
    }

    // Initialize Web Audio API
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    try {
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS (Root Mean Square) for audio level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(100, (rms / 128) * 100);

        setAudioLevel(level);
        setIsSpeaking(level > (isLocal ? 10 : 8)); // Slightly different thresholds

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (error) {
      console.warn('Failed to create audio analyser:', error);
    }

    // Single cleanup function that handles everything
    return () => {
      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Close audio context
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close();
      }

      // Reset refs
      analyserRef.current = null;
      audioContextRef.current = null;
    };
  }, [audioEnabled, isLocal]);

  if (!isSpeaking || !audioEnabled) {
    return null;
  }

  // Calculate dynamic values based on audio level
  const normalizedLevel = Math.max(0.2, Math.min(1, audioLevel / 50)); // Normalize to 0.2-1 range
  const pulseSpeed = Math.max(0.3, 1.2 - audioLevel / 100); // Faster pulse for louder audio

  return (
    <div className="absolute top-2 right-2 z-10">
      <div className="relative flex items-center justify-center w-8 h-8 bg-green-600/90 rounded-full border border-green-400/50 backdrop-blur-sm">
        <Mic className="w-3.5 h-3.5 text-white" />

        {/* Dynamic animated rings based on audio level */}
        <div
          className="absolute border-2 border-green-400 rounded-full transition-all duration-100 ease-out"
          style={{
            width: `${32 + audioLevel * 0.4}px`,
            height: `${32 + audioLevel * 0.4}px`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: normalizedLevel * 0.8,
            animationDuration: `${pulseSpeed}s`,
          }}
        />
        <div
          className="absolute border-2 border-green-400 rounded-full transition-all duration-150 ease-out"
          style={{
            width: `${36 + audioLevel * 0.6}px`,
            height: `${36 + audioLevel * 0.6}px`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: normalizedLevel * 0.6,
            animationDuration: `${pulseSpeed * 1.2}s`,
          }}
        />
        <div
          className="absolute border-2 border-green-400 rounded-full transition-all duration-200 ease-out"
          style={{
            width: `${40 + audioLevel * 0.8}px`,
            height: `${40 + audioLevel * 0.8}px`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: normalizedLevel * 0.4,
            animationDuration: `${pulseSpeed * 1.4}s`,
          }}
        />
      </div>
    </div>
  );
};
