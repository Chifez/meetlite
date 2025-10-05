// Environment variables configuration
export const env = {
  // API Gateway URL - single entry point for all API calls
  API_GATEWAY_URL:
    import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000',

  // Other configuration
  BASE_URL: import.meta.env.VITE_BASE_URL,
  VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY,
} as const;

// Type-safe environment variables
export type Env = typeof env;
