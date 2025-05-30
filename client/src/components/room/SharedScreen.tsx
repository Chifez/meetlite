import React from 'react';
import { useRef, useEffect } from 'react';

interface SharedScreenProps {
  stream: MediaStream | null;
}

export const SharedScreen: React.FC<SharedScreenProps> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="w-full h-[50vh] bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
    </div>
  );
};
