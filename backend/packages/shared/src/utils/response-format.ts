/**
 * Standardized Response Format Utilities
 *
 * Provides consistent response structure across all services
 * to ensure frontend compatibility and maintainability
 */

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];

export interface ExpressResponse {
  status: (code: number) => {
    json: (body: any) => any;
    send: () => any;
  };
}

/**
 * Standard Success Response Format
 * @param res - Express response object
 * @param statusCode - HTTP status code
 * @param data - Response data
 * @param message - Optional success message
 * @returns Express response
 */
export const sendSuccess = (
  res: any,
  statusCode: number = HTTP_STATUS.OK,
  data: any = null,
  message: string | null = null
): any => {
  const response: Record<string, any> = {
    success: true,
  };

  if (data !== null) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
};

/**
 * Standard Error Response Format
 * @param res - Express response object
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @param error - Optional error details
 * @param metadata - Optional additional metadata (e.g., upgradeRequired, currentPlan)
 * @returns Express response
 */
export const sendError = (
  res: any,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  message: string = 'An error occurred',
  error: any = null,
  metadata: any = null
): any => {
  const response: Record<string, any> = {
    success: false,
    message,
  };

  if (error && process.env.NODE_ENV === 'development') {
    response.error = error;
  }

  if (metadata) {
    Object.assign(response, metadata);
  }

  return res.status(statusCode).json(response);
};

/**
 * Helper functions for common responses
 */
export const ResponseHelpers = {
  /**
   * 200 OK - Success response with data
   */
  ok: (res: any, data: any, message: string | null = null) => {
    return sendSuccess(res, HTTP_STATUS.OK, data, message);
  },

  /**
   * 201 Created - Resource created successfully
   */
  created: (res: any, data: any, message: string = 'Resource created successfully') => {
    return sendSuccess(res, HTTP_STATUS.CREATED, data, message);
  },

  /**
   * 204 No Content - Success with no response body
   */
  noContent: (res: any) => {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};

/**
 * Backward compatibility: Legacy response format
 * Some existing code may use direct res.json() with { data: ... } or { message: ... }
 * This helper maintains compatibility while encouraging migration to standardized format
 */
export const sendLegacySuccess = (res: any, data: any, statusCode: number = HTTP_STATUS.OK): any => {
  // If data is already an object with 'data' key, use it directly
  if (data && typeof data === 'object' && 'data' in data) {
    return res.status(statusCode).json(data);
  }
  // Otherwise wrap in { data: ... } for backward compatibility
  return res.status(statusCode).json({ data });
};

export default {
  HTTP_STATUS,
  sendSuccess,
  sendError,
  ResponseHelpers,
  sendLegacySuccess,
};
