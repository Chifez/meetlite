import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

/**
 * Create Winston logger with structured logging
 */
const createLogger = () => {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
  );

  // Console format for development
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
      format: 'HH:mm:ss',
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let metaStr = '';
      if (Object.keys(meta).length > 0) {
        metaStr = ` ${JSON.stringify(meta, null, 2)}`;
      }
      return `${timestamp} [${level}] ${message}${metaStr}`;
    })
  );

  // Create logger instance
  const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: {
      service: 'mediasoup-service',
      version: '1.0.0',
    },
    transports: [
      new winston.transports.Console({
        format: isDevelopment ? consoleFormat : logFormat,
      }),
    ],
  });

  // Add file transports for production
  if (process.env.NODE_ENV === 'production') {
    logger.add(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );

    logger.add(
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  }

  return logger;
};

// Create and export logger instance
export const logger = createLogger();

// Export logger creation function for testing
export { createLogger };

// Add request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

export default logger;
