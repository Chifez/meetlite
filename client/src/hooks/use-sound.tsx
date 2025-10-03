import { useCallback } from 'react';

export const useSound = () => {
  const playSound = useCallback((soundPath: string, volume: number = 0.5) => {
    try {
      // Create new audio instance for each play to avoid conflicts
      const audio = new Audio(soundPath);
      audio.volume = Math.max(0, Math.min(1, volume)); // Clamp volume between 0 and 1

      // Play the sound
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('🔊 Sound played successfully');
          })
          .catch((error) => {
            console.warn('🔇 Could not play sound:', error);
          });
      }
    } catch (error) {
      console.warn('Error creating audio element:', error);
    }
  }, []);

  const playUserJoinSound = useCallback(() => {
    playSound('/user-join.mp3', 0.7);
  }, [playSound]);

  const playUserLeaveSound = useCallback(() => {
    playSound('/user-leave.mp3', 0.4);
  }, [playSound]);

  return {
    playUserJoinSound,
    playUserLeaveSound,
  };
};
