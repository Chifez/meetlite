// Environment variables configuration
export const env = {
  // API Gateway URL - single entry point for all API calls
  API_GATEWAY_URL:
    import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000',

  // Signaling Service URL - for Socket.IO connections (P2P WebRTC)
  SIGNALING_SERVER_URL:
    import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:5002',

  // MediaSoup Service URL - for MediaSoup WebRTC connections
  MEDIASOUP_SERVER_URL:
    import.meta.env.VITE_MEDIASOUP_SERVER_URL || 'http://localhost:3003',

  // Other configuration
  BASE_URL: import.meta.env.VITE_BASE_URL,
  VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY,
} as const;

// Type-safe environment variables
export type Env = typeof env;
