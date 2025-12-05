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
 * Extract error message from API response
 */
export function extractError(response: any): string {
  if (response.response?.data?.message) {
    return response.response.data.message;
  }
  if (response.message) {
    return response.message;
  }
  return 'An error occurred';
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
