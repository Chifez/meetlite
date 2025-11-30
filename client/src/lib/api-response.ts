/**
 * API Response Utilities
 *
 * Handles standardized response format from backend
 * Backend returns: { success: boolean, data?: any, message?: string }
 * This utility extracts the data consistently
 */

/**
 * Extract data from API response
 * Handles both new standardized format and legacy format for backward compatibility
 */
export function extractData<T>(response: any): T {
  // New standardized format: { success: true, data: {...} }
  if (
    response.data &&
    typeof response.data === 'object' &&
    'success' in response.data
  ) {
    return response.data.data as T;
  }

  // Legacy format: direct data
  return response.data as T;
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



