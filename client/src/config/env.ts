// Environment variables configuration
export const env = {
  // API Gateway URL - single entry point for all API calls
  API_GATEWAY_URL:
    import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000',

  // MediaSoup Service URL - for MediaSoup WebRTC connections
  MEDIASOUP_SERVER_URL:
    import.meta.env.VITE_MEDIASOUP_SERVER_URL || 'http://localhost:3003',

  // Other configuration
  BASE_URL: import.meta.env.VITE_BASE_URL,
  VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY,
  CALENDLY_URL: import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com/emmanuel01/meetlite-product-demo',
} as const;

// Type-safe environment variables
export type Env = typeof env;
