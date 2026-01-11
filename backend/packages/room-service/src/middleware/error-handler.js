import { AppError } from '@minimeet/shared';

export const errorHandler = (err, req, res, next) => {
  // Clone the error to avoid mutation
  let error = { ...err };
  error.message = err.message;

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err.stack);
  }

  // MongoDB Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val) => val.message);
    error = AppError.validation('Invalid input data provided', errors);
  }

  // MongoDB Cast Error (Invalid ObjectId)
  if (err.name === 'CastError') {
    error = new AppError('SYSTEM_9007', 'Invalid ID format');
  }

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = Object.values(err.keyValue)[0];
    error = new AppError('SYSTEM_9007', `${field}: '${value}' already exists`);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('AUTH_1003', 'Invalid authentication token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError(
      'AUTH_1002',
      'Your session has expired. Please log in again'
    );
  }

  // Send error response
  sendErrorResponse(error, req, res);
};

const sendErrorResponse = (err, req, res) => {
  // Operational errors that we trust to show to client
  if (err.isOperational) {
    const response = err.toResponse
      ? err.toResponse()
      : {
          success: false,
          message: err.message,
          code: err.code,
          timestamp: err.timestamp,
        };

    // Add validation errors if they exist
    if (err.errors) {
      response.errors = err.errors;
    }

    return res.status(err.statusCode || 500).json(response);
  }

  // Programming or unknown errors - convert to AppError and don't leak details in production
  console.error('Unknown Error:', err);

  const appError = AppError.internal(
    process.env.NODE_ENV === 'development'
      ? err.message
      : 'Something went wrong. Please try again later.'
  );

  const response = appError.toResponse();
  return res.status(appError.statusCode || 500).json(response);
};

// 404 handler for unknown routes
export const notFoundHandler = (req, res, next) => {
  const error = AppError.notFound(`Route ${req.originalUrl} not found`);
  next(error);
};

// Async error wrapper to catch async errors
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
