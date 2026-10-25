import winston from 'winston';
import { getCorrelationId } from '../telemetry/correlation.js';

/**
 * Winston format enricher injecting correlationId from AsyncLocalStorage
 */
const correlationEnricher = winston.format((info) => {
  const correlationId = getCorrelationId();
  if (correlationId && !info.correlationId) {
    info.correlationId = correlationId;
  }
  return info;
});

/**
 * Creates a Winston logger instance configuration with service context
 * and automatic correlation ID enrichment.
 */
export const createLogger = (serviceName: string) => {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      correlationEnricher(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      isDevelopment ? winston.format.prettyPrint() : winston.format.json()
    ),
    defaultMeta: { service: serviceName },
    transports: [new winston.transports.Console()],
  });
};
