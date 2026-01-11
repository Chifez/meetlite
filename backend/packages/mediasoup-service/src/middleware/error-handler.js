import { logger } from '../utils/logger.js';

/**
 * Global error handling middleware
 */
export const errorHandler = (error, req, res, next) => {
  logger.error('Global error handler', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Default error response
  let status = 500;
  let message = 'Internal server error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    status = 400;
    message = 'Validation error';
  } else if (error.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
  } else if (error.name === 'ForbiddenError') {
    status = 403;
    message = 'Forbidden';
  } else if (error.name === 'NotFoundError') {
    status = 404;
    message = 'Not found';
  } else if (error.name === 'ConflictError') {
    status = 409;
    message = 'Conflict';
  } else if (error.name === 'RateLimitError') {
    status = 429;
    message = 'Too many requests';
  }

  const response = {
    success: false,
    message,
    ...(isDevelopment && {
      error: error.message,
      stack: error.stack,
    }),
  };

  res.status(status).json(response);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.url,
    method: req.method,
  });
};

/**
 * Async handler wrapper for route handlers
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Socket.IO error handler
 */
export const socketErrorHandler = (error, socket) => {
  logger.error('Socket.IO error handler', {
    error: error.message,
    stack: error.stack,
    socketId: socket.id,
    userId: socket.user?.userId,
  });

  // Send error to client
  socket.emit('error', {
    message: 'An error occurred',
    ...(process.env.NODE_ENV === 'development' && {
      error: error.message,
    }),
  });
};

/**
 * Format validation errors
 */
export const formatValidationError = (error) => {
  if (error.name === 'ValidationError' && error.errors) {
    const formattedErrors = {};
    for (const field in error.errors) {
      formattedErrors[field] = error.errors[field].message;
    }
    return {
      message: 'Validation failed',
      errors: formattedErrors,
    };
  }
  return { message: error.message };
};

/**
 * Rate limiting error
 */
export const createRateLimitError = (message = 'Too many requests') => {
  const error = new Error(message);
  error.name = 'RateLimitError';
  return error;
};

/**
 * Validation error
 */
export const createValidationError = (message = 'Validation failed') => {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
};

/**
 * Not found error
 */
export const createNotFoundError = (message = 'Resource not found') => {
  const error = new Error(message);
  error.name = 'NotFoundError';
  return error;
};

/**
 * Unauthorized error
 */
export const createUnauthorizedError = (message = 'Unauthorized') => {
  const error = new Error(message);
  error.name = 'UnauthorizedError';
  return error;
};

/**
 * Forbidden error
 */
export const createForbiddenError = (message = 'Forbidden') => {
  const error = new Error(message);
  error.name = 'ForbiddenError';
  return error;
};

/**
 * Conflict error
 */
export const createConflictError = (message = 'Conflict') => {
  const error = new Error(message);
  error.name = 'ConflictError';
  return error;
};
