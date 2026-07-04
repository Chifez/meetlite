// Base application error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public timestamp: string;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}
