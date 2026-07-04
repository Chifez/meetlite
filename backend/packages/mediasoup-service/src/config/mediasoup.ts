import os from 'os';

/**
 * Get local IP address for MediaSoup
 */
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const networkInterface = interfaces[name];
    if (networkInterface) {
      for (const iface of networkInterface) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  return '127.0.0.1';
}

/**
 * MediaSoup configuration
 */
export const mediasoupConfig = {
  // Worker settings
  worker: {
    rtcMinPort: parseInt(process.env.RTC_MIN_PORT || '10000'),
    rtcMaxPort: parseInt(process.env.RTC_MAX_PORT || '10100'),
    logLevel: (process.env.WORKER_LOG_LEVEL || 'debug') as any,
    logTags: (process.env.WORKER_LOG_TAGS
      ? process.env.WORKER_LOG_TAGS.split(',')
      : [
          'info',
          'ice',
          'dtls',
          'rtp',
          'srtp',
          'rtcp',
          'rtx',
          'bwe',
          'score',
          'simulcast',
          'svc',
        ]) as any[],
  },

  // Router settings with supported codecs
  router: {
    mediaCodecs: [
      // Audio codecs
      {
        kind: 'audio' as const,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          minptime: 10,
          useinbandfec: 1,
        },
      },
      // Video codecs
      {
        kind: 'video' as const,
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  },

  // WebRTC transport settings
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: process.env.ANNOUNCED_IP || getLocalIP(),
      },
    ],
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  },

  // Plain transport settings (for recording)
  plainTransport: {
    listenIp: {
      ip: '0.0.0.0',
      announcedIp: process.env.ANNOUNCED_IP || getLocalIP(),
    },
    maxSctpMessageSize: 262144,
  },

  // ICE servers
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(process.env.TURN_SERVERS ? JSON.parse(process.env.TURN_SERVERS) : []),
  ] as any[],

  // Organization-aware settings
  organization: {
    maxParticipants: 50,
    maxBandwidthPerParticipant: 1000000, // 1 Mbps
    maxRecordingBitrate: 2000000, // 2 Mbps
    maxScreenShareBitrate: 3000000, // 3 Mbps
  },

  // Performance settings
  performance: {
    workerPoolSize: os.cpus().length,
    maxWorkers: 10,
    workerHealthCheckInterval: 30000, // 30 seconds
  },
};

export default mediasoupConfig;
