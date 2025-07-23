import type {
  RtpCodecCapability,
  TransportListenIp,
  WorkerLogTag,
} from 'mediasoup/node/lib/types';
import os from 'os';

let numWorkers = Object.keys(os.cpus()).length;
if (process.platform === 'win32') {
  numWorkers = 1; // Mediasoup multi-worker not supported on Windows
}

export const config = {
  numWorkers,
  worker: {
    logLevel: (process.env.LOG_LEVEL || 'warn') as
      | 'debug'
      | 'warn'
      | 'error'
      | 'none',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'] as WorkerLogTag[],
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || '40000'),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || '49999'),
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          maxPlaybackRate: 48000,
          stereo: 1,
          useinbandfec: 1,
        },
      } as RtpCodecCapability,
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      } as RtpCodecCapability,
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
        },
      } as RtpCodecCapability,
    ],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || null,
      } as TransportListenIp,
    ],
    initialAvailableOutgoingBitrate: 600000,
    minimumAvailableOutgoingBitrate: 300000,
    maxIncomingBitrate: 1500000,
    maxSctpMessageSize: 262144,
    enableSctp: true,
    numSctpStreams: { OS: 1024, MIS: 1024 },
  },
};
