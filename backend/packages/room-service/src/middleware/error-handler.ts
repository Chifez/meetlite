import { Request, Response, NextFunction } from 'express';
import { AppError } from '@minimeet/shared';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = { ...err };
  error.message = err.message;
  error.isOperational = err.isOperational;
  error.statusCode = err.statusCode;
  error.code = err.code;
  error.timestamp = err.timestamp;
  error.errors = err.errors;

  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err.stack);
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val: any) => val.message);
    error = AppError.validation('Invalid input data provided', errors);
  }

  if (err.name === 'CastError') {
    error = new AppError('SYSTEM_9007', 'Invalid ID format') as any;
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = Object.values(err.keyValue)[0];
    error = new AppError('SYSTEM_9007', `${field}: '${value}' already exists`) as any;
  }

  if (err.name === 'JsonWebTokenError') {
    error = new AppError('AUTH_1003', 'Invalid authentication token') as any;
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError(
      'AUTH_1002',
      'Your session has expired. Please log in again'
    ) as any;
  }

  sendErrorResponse(error, req, res);
};

const sendErrorResponse = (err: any, req: Request, res: Response) => {
  if (err.isOperational) {
    const response = err.toResponse
      ? err.toResponse()
      : {
          success: false,
          message: err.message,
          code: err.code,
          timestamp: err.timestamp,
        };

    if (err.errors) {
      response.errors = err.errors;
    }

    return res.status(err.statusCode || 500).json(response);
  }

  console.error('Unknown Error:', err);

  const appError = AppError.internal(
    process.env.NODE_ENV === 'development'
      ? err.message
      : 'Something went wrong. Please try again later.'
  );

  const response = appError.toResponse();
  return res.status(appError.statusCode || 500).json(response);
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = AppError.notFound(`Route ${req.originalUrl} not found`);
  next(error);
};

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
