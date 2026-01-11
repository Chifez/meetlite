import { ERROR_CODES, createError } from '../constants/error-codes.js';

/**
 * Enhanced Application Error class with standardized error codes
 */
export class AppError extends Error {
  constructor(errorCode, customMessage = null, additionalData = {}) {
    // Get error details from error codes
    const errorDetails = createError(errorCode, customMessage, additionalData);

    super(errorDetails.message);

    this.name = this.constructor.name;
    this.code = errorDetails.code;
    this.statusCode = errorDetails.statusCode;
    this.description = errorDetails.description;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    // Add any additional data
    Object.assign(this, additionalData);

    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a formatted error response for API responses
   * @returns {Object} Formatted error response
   */
  toResponse() {
    return {
      success: false,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      ...(this.description &&
        process.env.NODE_ENV === 'development' && {
          description: this.description,
        }),
    };
  }

  /**
   * Static method to create common error types
   */
  static validation(message, errors = []) {
    const error = new AppError('SYSTEM_9007', message);
    error.errors = errors;
    return error;
  }

  static notFound(resource = 'Resource') {
    return new AppError('SYSTEM_9008', `${resource} not found`);
  }

  static unauthorized(message = null) {
    return new AppError('AUTH_1001', message);
  }

  static forbidden(message = null) {
    return new AppError('AUTH_1004', message);
  }

  static internal(message = null) {
    return new AppError('SYSTEM_9006', message);
  }

  static rateLimit(message = null) {
    return new AppError('SYSTEM_9004', message);
  }

  static conflict(message = null) {
    return new AppError('SYSTEM_9009', message);
  }
}

export default AppError;
