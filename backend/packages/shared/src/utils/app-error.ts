import { createError } from '../constants/error-codes.js';

/**
 * Enhanced Application Error class with standardized error codes
 */
export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public description: string;
  public isOperational: boolean;
  public timestamp: string;
  public errors?: any[];

  constructor(errorCode: string, customMessage: string | null = null, additionalData: Record<string, any> = {}) {
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
   * @returns Formatted error response
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
  static validation(message: string, errors: any[] = []) {
    const error = new AppError('SYSTEM_9007', message);
    error.errors = errors;
    return error;
  }

  static notFound(resource = 'Resource') {
    return new AppError('SYSTEM_9008', `${resource} not found`);
  }

  static unauthorized(message: string | null = null) {
    return new AppError('AUTH_1001', message);
  }

  static forbidden(message: string | null = null) {
    return new AppError('AUTH_1004', message);
  }

  static internal(message: string | null = null) {
    return new AppError('SYSTEM_9006', message);
  }

  static rateLimit(message: string | null = null) {
    return new AppError('SYSTEM_9004', message);
  }

  static conflict(message: string | null = null) {
    return new AppError('SYSTEM_9009', message);
  }
}

export default AppError;
