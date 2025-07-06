// Environment variables configuration
export const env = {
  AUTH_API_URL: import.meta.env.VITE_AUTH_API_URL,

  ROOM_API_URL: import.meta.env.VITE_ROOM_API_URL,

  SIGNALING_SERVER_URL: import.meta.env.VITE_SIGNALING_SERVER_URL,

  AI_SERVICE_URL: import.meta.env.VITE_AI_SERVICE_URL || '/api/ai',

  CALENDAR_API_URL: import.meta.env.VITE_CALENDAR_SERVICE_URL,
} as const;

// Type-safe environment variables
export type Env = typeof env;
