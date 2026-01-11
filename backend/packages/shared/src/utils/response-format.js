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
};

/**
 * Standard Success Response Format
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {any} data - Response data
 * @param {string} message - Optional success message
 * @returns {Object} Express response
 */
export const sendSuccess = (
  res,
  statusCode = HTTP_STATUS.OK,
  data = null,
  message = null
) => {
  const response = {
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
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {any} error - Optional error details
 * @param {any} metadata - Optional additional metadata (e.g., upgradeRequired, currentPlan)
 * @returns {Object} Express response
 */
export const sendError = (
  res,
  statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  message = 'An error occurred',
  error = null,
  metadata = null
) => {
  const response = {
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
  ok: (res, data, message = null) => {
    return sendSuccess(res, HTTP_STATUS.OK, data, message);
  },

  /**
   * 201 Created - Resource created successfully
   */
  created: (res, data, message = 'Resource created successfully') => {
    return sendSuccess(res, HTTP_STATUS.CREATED, data, message);
  },

  /**
   * 204 No Content - Success with no response body
   */
  noContent: (res) => {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};

/**
 * Backward compatibility: Legacy response format
 * Some existing code may use direct res.json() with { data: ... } or { message: ... }
 * This helper maintains compatibility while encouraging migration to standardized format
 */
export const sendLegacySuccess = (res, data, statusCode = HTTP_STATUS.OK) => {
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
