import winston from 'winston';

/**
 * Creates a Winston logger instance configuration with service context
 */
export const createLogger = (serviceName: string) => {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      isDevelopment ? winston.format.prettyPrint() : winston.format.json()
    ),
    defaultMeta: { service: serviceName },
    transports: [new winston.transports.Console()],
  });
};
