/**
 * API Response Utilities
 *
 * Handles standardized response format from backend
 * Backend returns various formats:
 * - Standard: { success: true, data: {...} }
 * - Analytics: { success: true, analytics: {...} }
 * - Recordings: { success: true, recordings: [...], pagination: {...} }
 * - Streaming: { success: true, streamingUrl: "...", thumbnailUrl: "..." }
 * - Stats: { success: true, stats: {...} }
 * This utility extracts the data consistently from all formats
 */

/**
 * Extract data from API response
 * Intelligently handles multiple response formats for backward compatibility
 * and gradual migration to standardized format
 */
export function extractData<T>(response: any): T {
  if (!response || !response.data) {
    return response as T;
  }

  const responseData = response.data;

  // Handle standardized format: { success: true, data: {...} }
  if (
    typeof responseData === 'object' &&
    'success' in responseData &&
    responseData.success === true
  ) {
    // Standard format - data is nested under 'data' property
    if ('data' in responseData && responseData.data !== undefined) {
      return responseData.data as T;
    }

    // Handle route-specific response structures
    // Analytics route: { success: true, analytics: {...} }
    if ('analytics' in responseData) {
      return responseData.analytics as T;
    }

    // Recordings list route: { success: true, recordings: [...], pagination: {...} }
    if ('recordings' in responseData || 'pagination' in responseData) {
      return responseData as T;
    }

    // Streaming route: { success: true, streamingUrl: "...", thumbnailUrl: "..." }
    if ('streamingUrl' in responseData || 'thumbnailUrl' in responseData) {
      return responseData as T;
    }

    // Stats route: { success: true, stats: {...} }
    if ('stats' in responseData) {
      return responseData.stats as T;
    }

    // If success: true but no recognized data structure, return the whole object
    // excluding 'success' and 'message' properties
    const { success, message, ...rest } = responseData;
    if (Object.keys(rest).length > 0) {
      return rest as T;
    }
  }

  // Legacy format: direct data (no success property)
  return responseData as T;
}

/**
 * Extract a user-friendly error message from an API or network error.
 *
 * Priority order:
 * 1. error.response.data.message  (standard backend: { message: "..." })
 * 2. error.response.data.error    (alternative backend: { error: "..." })
 * 3. error.message                (network/timeout errors, or thrown Errors)
 * 4. returns null so callers can supply their own fallback
 */
export function extractError(error: unknown): string | null {
  if (!error) return null;

  // Axios error with a response body
  if (typeof error === 'object' && error !== null) {
    const err = error as any;

    // Standard backend: { message: "..." }
    if (typeof err.response?.data?.message === 'string' && err.response.data.message.trim()) {
      return err.response.data.message.trim();
    }

    // Alternative backend: { error: "..." }
    if (typeof err.response?.data?.error === 'string' && err.response.data.error.trim()) {
      return err.response.data.error.trim();
    }

    // Network error / timeout / thrown Error instance
    if (typeof err.message === 'string' && err.message.trim()) {
      // Suppress raw Axios/network internals that aren't user-friendly
      const msg = err.message.trim();
      if (
        msg.startsWith('Network Error') ||
        msg.startsWith('timeout of') ||
        msg.startsWith('Request failed')
      ) {
        return null; // Let callers show a generic fallback
      }
      return msg;
    }
  }

  return null;
}

/**
 * Check if response indicates success
 */
export function isSuccess(response: any): boolean {
  if (
    response.data &&
    typeof response.data === 'object' &&
    'success' in response.data
  ) {
    return response.data.success === true;
  }
  // Legacy format - assume success if no error
  return !response.error && response.status >= 200 && response.status < 300;
}
