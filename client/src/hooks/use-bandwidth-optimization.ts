import { useState, useEffect, useCallback } from 'react';

export type BandwidthMode = 'high' | 'medium' | 'low';

interface BandwidthOptimizationOptions {
  participantCount: number;
  connectionQuality: 'excellent' | 'good' | 'poor';
  deviceCapability: 'high' | 'medium' | 'low';
  userPreference: 'quality' | 'performance' | 'balanced';
}

interface BandwidthSettings {
  mode: BandwidthMode;
  videoQuality: 'high' | 'medium' | 'low';
  maxConcurrentStreams: number;
  thumbnailSize: 'large' | 'medium' | 'small';
  frameRate: number;
  resolution: {
    width: number;
    height: number;
  };
  bitrate: number;
}

/**
 * Bandwidth Optimization Hook
 * Automatically adjusts video quality and stream parameters based on:
 * - Participant count
 * - Connection quality
 * - Device capability
 * - User preferences
 */
export const useBandwidthOptimization = (
  options: BandwidthOptimizationOptions
) => {
  const [bandwidthSettings, setBandwidthSettings] = useState<BandwidthSettings>(
    {
      mode: 'high',
      videoQuality: 'high',
      maxConcurrentStreams: 10,
      thumbnailSize: 'medium',
      frameRate: 30,
      resolution: { width: 1280, height: 720 },
      bitrate: 2000000,
    }
  );

  const [connectionQuality, setConnectionQuality] = useState<
    'excellent' | 'good' | 'poor'
  >('good');

  // Monitor connection quality
  useEffect(() => {
    const checkConnectionQuality = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        const effectiveType = connection?.effectiveType;

        if (effectiveType === '4g') {
          setConnectionQuality('excellent');
        } else if (effectiveType === '3g') {
          setConnectionQuality('good');
        } else {
          setConnectionQuality('poor');
        }
      }
    };

    checkConnectionQuality();

    // Check every 30 seconds
    const interval = setInterval(checkConnectionQuality, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate optimal bandwidth settings
  const calculateBandwidthSettings = useCallback((): BandwidthSettings => {
    const { participantCount, deviceCapability, userPreference } = options;

    // Base settings by participant count
    let baseSettings: BandwidthSettings;

    if (participantCount <= 2) {
      baseSettings = {
        mode: 'high',
        videoQuality: 'high',
        maxConcurrentStreams: 2,
        thumbnailSize: 'large',
        frameRate: 30,
        resolution: { width: 1920, height: 1080 },
        bitrate: 4000000,
      };
    } else if (participantCount <= 10) {
      baseSettings = {
        mode: 'high',
        videoQuality: 'high',
        maxConcurrentStreams: participantCount,
        thumbnailSize: 'medium',
        frameRate: 30,
        resolution: { width: 1280, height: 720 },
        bitrate: 2000000,
      };
    } else if (participantCount <= 25) {
      baseSettings = {
        mode: 'medium',
        videoQuality: 'medium',
        maxConcurrentStreams: Math.min(participantCount, 16),
        thumbnailSize: 'medium',
        frameRate: 24,
        resolution: { width: 960, height: 540 },
        bitrate: 1000000,
      };
    } else if (participantCount <= 50) {
      baseSettings = {
        mode: 'medium',
        videoQuality: 'medium',
        maxConcurrentStreams: 12,
        thumbnailSize: 'small',
        frameRate: 20,
        resolution: { width: 640, height: 360 },
        bitrate: 500000,
      };
    } else {
      baseSettings = {
        mode: 'low',
        videoQuality: 'low',
        maxConcurrentStreams: 8,
        thumbnailSize: 'small',
        frameRate: 15,
        resolution: { width: 480, height: 270 },
        bitrate: 250000,
      };
    }

    // Adjust based on connection quality
    if (connectionQuality === 'poor') {
      baseSettings.mode = 'low';
      baseSettings.videoQuality = 'low';
      baseSettings.frameRate = Math.max(10, baseSettings.frameRate - 10);
      baseSettings.bitrate = Math.max(100000, baseSettings.bitrate * 0.5);
      baseSettings.resolution = {
        width: Math.max(320, baseSettings.resolution.width * 0.5),
        height: Math.max(240, baseSettings.resolution.height * 0.5),
      };
    } else if (connectionQuality === 'excellent') {
      baseSettings.mode = 'high';
      baseSettings.videoQuality = 'high';
      baseSettings.frameRate = Math.min(60, baseSettings.frameRate + 10);
      baseSettings.bitrate = Math.min(8000000, baseSettings.bitrate * 1.5);
    }

    // Adjust based on device capability
    if (deviceCapability === 'low') {
      baseSettings.maxConcurrentStreams = Math.min(
        4,
        baseSettings.maxConcurrentStreams
      );
      baseSettings.frameRate = Math.max(15, baseSettings.frameRate - 5);
      baseSettings.resolution = {
        width: Math.max(480, baseSettings.resolution.width * 0.8),
        height: Math.max(360, baseSettings.resolution.height * 0.8),
      };
    } else if (deviceCapability === 'high') {
      baseSettings.maxConcurrentStreams = Math.min(
        participantCount,
        baseSettings.maxConcurrentStreams * 1.5
      );
    }

    // Adjust based on user preference
    if (userPreference === 'performance') {
      baseSettings.mode = 'low';
      baseSettings.videoQuality = 'low';
      baseSettings.frameRate = Math.max(15, baseSettings.frameRate - 5);
      baseSettings.bitrate = Math.max(100000, baseSettings.bitrate * 0.7);
    } else if (userPreference === 'quality') {
      baseSettings.mode = 'high';
      baseSettings.videoQuality = 'high';
      baseSettings.frameRate = Math.min(60, baseSettings.frameRate + 5);
      baseSettings.bitrate = Math.min(8000000, baseSettings.bitrate * 1.3);
    }

    return baseSettings;
  }, [options, connectionQuality]);

  // Update settings when dependencies change
  useEffect(() => {
    const newSettings = calculateBandwidthSettings();
    setBandwidthSettings(newSettings);
  }, [calculateBandwidthSettings]);

  // Get video constraints for a specific participant
  const getVideoConstraints = useCallback(
    (participantId: string, isMainSpeaker: boolean = false) => {
      const { resolution, frameRate } = bandwidthSettings;

      // Main speakers get higher quality
      if (isMainSpeaker) {
        return {
          width: Math.min(1920, resolution.width * 1.5),
          height: Math.min(1080, resolution.height * 1.5),
          frameRate: Math.min(60, frameRate + 10),
        };
      }

      return {
        width: resolution.width,
        height: resolution.height,
        frameRate: frameRate,
      };
    },
    [bandwidthSettings]
  );

  // Get audio constraints
  const getAudioConstraints = useCallback(() => {
    const baseBitrate =
      bandwidthSettings.mode === 'high'
        ? 128000
        : bandwidthSettings.mode === 'medium'
        ? 64000
        : 32000;

    return {
      bitrate: baseBitrate,
      sampleRate: bandwidthSettings.mode === 'high' ? 48000 : 44100,
    };
  }, [bandwidthSettings]);

  // Check if participant should be visible
  const shouldShowParticipant = useCallback(
    (participantIndex: number, isPinned: boolean = false) => {
      if (isPinned) return true;
      return participantIndex < bandwidthSettings.maxConcurrentStreams;
    },
    [bandwidthSettings.maxConcurrentStreams]
  );

  // Get thumbnail size class
  const getThumbnailSizeClass = useCallback(() => {
    const sizeMap = {
      large: 'w-32 h-24',
      medium: 'w-24 h-18',
      small: 'w-16 h-12',
    };
    return sizeMap[bandwidthSettings.thumbnailSize];
  }, [bandwidthSettings.thumbnailSize]);

  return {
    bandwidthSettings,
    connectionQuality,
    getVideoConstraints,
    getAudioConstraints,
    shouldShowParticipant,
    getThumbnailSizeClass,
    updateSettings: setBandwidthSettings,
  };
};
