import { AppError } from '../utils/errors.js';

export const errorHandler = (err, req, res, next) => {
  // Clone the error to avoid mutation
  let error = { ...err };
  error.message = err.message;

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error Stack:', err.stack);
  }

  // MongoDB Validation Error
  if (err.name === 'ValidationError') {
    const message = 'Validation Error';
    const errors = Object.values(err.errors).map((val) => val.message);
    error = new AppError(message, 400);
    error.errors = errors;
  }

  // MongoDB Cast Error (Invalid ObjectId)
  if (err.name === 'CastError') {
    const message = 'Invalid ID format';
    error = new AppError(message, 400);
  }

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = Object.values(err.keyValue)[0];
    const message = `${field}: '${value}' already exists`;
    error = new AppError(message, 409);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired. Please log in again';
    error = new AppError(message, 401);
  }

  // Send error response
  sendErrorResponse(error, req, res);
};

const sendErrorResponse = (err, req, res) => {
  // Operational errors that we trust to show to client
  if (err.isOperational) {
    const response = {
      success: false,
      message: err.message,
    };

    // Add validation errors if they exist
    if (err.errors) {
      response.errors = err.errors;
    }

    // Add error code for client handling
    if (err.code) {
      response.code = err.code;
    }

    return res.status(err.statusCode || 500).json(response);
  }

  // Programming or unknown errors - don't leak details in production
  console.error('💥 Unknown Error:', err);

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Something went wrong. Please try again later.',
  });
};

// 404 handler for unknown routes
export const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  const error = new AppError(message, 404);
  next(error);
};

// Async error wrapper to catch async errors
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
