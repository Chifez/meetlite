import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export const CORRELATION_HEADER = 'x-request-id';
export const ALT_CORRELATION_HEADER = 'x-correlation-id';

export interface CorrelationContext {
  correlationId: string;
  serviceName?: string;
  userId?: string;
  organizationId?: string;
  [key: string]: unknown;
}

/**
 * AsyncLocalStorage container for request-bound correlation context.
 * Enables zero-parameter context propagation across asynchronous boundaries.
 */
export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Get active correlation ID from current async context.
 */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

/**
 * Get full correlation context from current async context.
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

/**
 * Execute a callback within an explicit correlation context.
 */
export function runWithCorrelationContext<T>(
  context: CorrelationContext,
  fn: () => T
): T {
  return correlationStorage.run(context, fn);
}

/**
 * Validate and sanitize correlation ID.
 * Rejects header injection attempts (CRLF), non-alphanumeric special characters,
 * and oversized headers (> 128 characters).
 */
export function sanitizeCorrelationId(rawId: unknown): string | null {
  if (typeof rawId !== 'string') {
    return null;
  }

  const trimmed = rawId.trim();
  if (!trimmed || trimmed.length > 128) {
    return null;
  }

  // Allow standard UUID, ULID, alphanumeric with hyphens, underscores, dots
  const validRegex = /^[a-zA-Z0-9_\-\.]+$/;
  if (!validRegex.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Express middleware to assign or preserve correlation IDs across incoming requests
 * and propagate context via AsyncLocalStorage.
 */
export function createCorrelationMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rawHeader =
      req.headers[CORRELATION_HEADER] || req.headers[ALT_CORRELATION_HEADER];

    const rawId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const sanitizedId = sanitizeCorrelationId(rawId);
    const correlationId = sanitizedId ?? crypto.randomUUID();

    // Attach to request object
    (req as any).correlationId = correlationId;

    // Set response headers
    res.setHeader(CORRELATION_HEADER, correlationId);
    res.setHeader(ALT_CORRELATION_HEADER, correlationId);

    const context: CorrelationContext = {
      correlationId,
      serviceName,
    };

    correlationStorage.run(context, () => {
      next();
    });
  };
}

export interface RequestLogEntry {
  level: 'info' | 'warn' | 'error';
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  correlationId: string;
  service: string;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}

export interface RequestLoggingOptions {
  serviceName: string;
  skipPaths?: string[];
  logger?: {
    info: (msg: string, meta?: any) => void;
    warn: (msg: string, meta?: any) => void;
    error: (msg: string, meta?: any) => void;
  };
  onLog?: (entry: RequestLogEntry) => void;
}

/**
 * Request telemetry middleware recording latency and completion status.
 * Automatically excludes noisy health probes from log streams.
 */
export function createRequestLoggingMiddleware(options: RequestLoggingOptions) {
  const skipSet = new Set(
    options.skipPaths ?? ['/health', '/health/live', '/health/ready', '/health/startup']
  );

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.originalUrl || req.url || '';
    const cleanPath = path.split('?')[0];

    if (skipSet.has(cleanPath)) {
      return next();
    }

    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationNs = process.hrtime.bigint() - start;
      const durationMs = Number(durationNs) / 1_000_000;
      const roundedDuration = Math.round(durationMs * 100) / 100;

      const correlationId =
        (req as any).correlationId ||
        getCorrelationId() ||
        (res.getHeader(CORRELATION_HEADER) as string) ||
        'unknown';

      const statusCode = res.statusCode;
      let level: 'info' | 'warn' | 'error' = 'info';
      if (statusCode >= 500) {
        level = 'error';
      } else if (statusCode >= 400) {
        level = 'warn';
      }

      const entry: RequestLogEntry = {
        level,
        method: req.method,
        path: cleanPath,
        statusCode,
        durationMs: roundedDuration,
        correlationId,
        service: options.serviceName,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        timestamp: new Date().toISOString(),
      };

      if (options.onLog) {
        options.onLog(entry);
      }

      if (options.logger) {
        const message = `HTTP ${entry.method} ${entry.path} ${entry.statusCode} (${entry.durationMs}ms)`;
        if (level === 'error') {
          options.logger.error(message, entry);
        } else if (level === 'warn') {
          options.logger.warn(message, entry);
        } else {
          options.logger.info(message, entry);
        }
      }
    });

    next();
  };
}
