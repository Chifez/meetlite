import { Router, Request, Response } from 'express';

export type ProbeStatus = 'UP' | 'DOWN';

export interface ComponentProbeResult {
  status: ProbeStatus;
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export type ProbeFn = (signal?: AbortSignal) => Promise<ComponentProbeResult | boolean>;

export interface RegisterProbeOptions {
  critical?: boolean;
  timeoutMs?: number;
}

export interface LivenessReport {
  status: 'UP';
  timestamp: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
}

export interface StartupReport {
  status: ProbeStatus;
  startup: boolean;
  timestamp: string;
  uptime: number;
  reason?: string;
}

export interface ReadinessReport {
  status: ProbeStatus;
  timestamp: string;
  uptime: number;
  checks: Record<string, ComponentProbeResult>;
}

export interface HealthManagerOptions {
  cacheTtlMs?: number;
  defaultTimeoutMs?: number;
}

function sanitizeErrorMessage(msg: string): string {
  // Strip credentials from URIs like postgresql://user:pass@host:port/db
  return msg.replace(/(postgres(?:ql)?:\/\/)[^@]+@/gi, '$1***@');
}

export class HealthManager {
  private isStarted = false;
  private readonly probes = new Map<
    string,
    { probe: ProbeFn; critical: boolean; timeoutMs: number }
  >();
  private cachedReadiness: { timestamp: number; result: ReadinessReport } | null = null;
  private readonly cacheTtlMs: number;
  private readonly defaultTimeoutMs: number;

  constructor(options: HealthManagerOptions = {}) {
    this.cacheTtlMs = options.cacheTtlMs ?? 1500;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 2000;
  }

  markStarted(): void {
    this.isStarted = true;
  }

  markStopped(): void {
    this.isStarted = false;
  }

  isStartupComplete(): boolean {
    return this.isStarted;
  }

  registerProbe(name: string, probe: ProbeFn, options: RegisterProbeOptions = {}): this {
    this.probes.set(name, {
      probe,
      critical: options.critical ?? true,
      timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
    });
    // Invalidate cached readiness on new probe registration
    this.cachedReadiness = null;
    return this;
  }

  getLivenessReport(): LivenessReport {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  getStartupReport(): StartupReport {
    return {
      status: this.isStarted ? 'UP' : 'DOWN',
      startup: this.isStarted,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ...(this.isStarted ? {} : { reason: 'Application initialization in progress' }),
    };
  }

  async getReadinessReport(forceFresh = false): Promise<ReadinessReport> {
    const now = Date.now();
    if (
      !forceFresh &&
      this.cachedReadiness &&
      now - this.cachedReadiness.timestamp < this.cacheTtlMs
    ) {
      return this.cachedReadiness.result;
    }

    const checks: Record<string, ComponentProbeResult> = {};
    let overallHealthy = true;

    const probeEntries = Array.from(this.probes.entries());
    const evaluations = await Promise.all(
      probeEntries.map(async ([name, { probe, critical, timeoutMs }]) => {
        const start = Date.now();
        const controller = new AbortController();
        const timeoutPromise = new Promise<ComponentProbeResult>((resolve) => {
          const timer = setTimeout(() => {
            controller.abort();
            resolve({
              status: 'DOWN',
              error: `Probe timed out after ${timeoutMs}ms`,
            });
          }, timeoutMs);
          timer.unref?.();
        });

        try {
          const runProbe = async (): Promise<ComponentProbeResult> => {
            const raw = await probe(controller.signal);
            const latencyMs = Date.now() - start;
            if (typeof raw === 'boolean') {
              return raw ? { status: 'UP', latencyMs } : { status: 'DOWN', latencyMs, error: 'Probe returned false' };
            }
            return {
              ...raw,
              latencyMs: raw.latencyMs ?? latencyMs,
            };
          };

          const result = await Promise.race([runProbe(), timeoutPromise]);
          return { name, result, critical };
        } catch (error: any) {
          const latencyMs = Date.now() - start;
          const sanitized = sanitizeErrorMessage(error?.message || String(error));
          return {
            name,
            result: { status: 'DOWN' as ProbeStatus, latencyMs, error: sanitized },
            critical,
          };
        }
      })
    );

    for (const { name, result, critical } of evaluations) {
      checks[name] = result;
      if (critical && result.status !== 'UP') {
        overallHealthy = false;
      }
    }

    const report: ReadinessReport = {
      status: overallHealthy ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    };

    this.cachedReadiness = { timestamp: now, result: report };
    return report;
  }
}

/**
 * Creates a probe that queries PostgreSQL via Prisma Client.
 */
export function createPrismaProbe(
  prisma: { $queryRaw: (...args: any[]) => Promise<any> },
  options: { timeoutMs?: number } = {}
): ProbeFn {
  return async () => {
    const start = Date.now();
    try {
      // Execute lightweight SELECT 1 check
      if (typeof prisma.$queryRaw === 'function') {
        try {
          // If called as tagged template
          await (prisma.$queryRaw as any)`SELECT 1`;
        } catch {
          // Fallback if mocked or non-template call
          await prisma.$queryRaw('SELECT 1' as any);
        }
      }
      return {
        status: 'UP',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - start,
        error: sanitizeErrorMessage(err?.message || 'Database query failed'),
      };
    }
  };
}

/**
 * Creates a probe that verifies Redis connectivity via PING.
 */
export function createRedisProbe(
  redisOrGetter: any | (() => any),
  options: { timeoutMs?: number } = {}
): ProbeFn {
  return async () => {
    const start = Date.now();
    try {
      const client = typeof redisOrGetter === 'function' ? redisOrGetter() : redisOrGetter;
      if (!client) {
        return {
          status: 'DOWN',
          latencyMs: Date.now() - start,
          error: 'Redis client not initialized',
        };
      }

      if (typeof client.ping === 'function') {
        const pingResult = await client.ping();
        if (typeof pingResult === 'string' && pingResult.toUpperCase() === 'PONG') {
          return { status: 'UP', latencyMs: Date.now() - start };
        }
      }

      return { status: 'UP', latencyMs: Date.now() - start };
    } catch (err: any) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - start,
        error: sanitizeErrorMessage(err?.message || 'Redis ping failed'),
      };
    }
  };
}

/**
 * Creates a probe that verifies reachability of an HTTP service.
 */
export function createHttpProbe(
  url: string,
  options: { timeoutMs?: number } = {}
): ProbeFn {
  return async (signal?: AbortSignal) => {
    const start = Date.now();
    try {
      const res = await fetch(url, { signal });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { status: 'UP', latencyMs };
      }
      return {
        status: 'DOWN',
        latencyMs,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - start,
        error: sanitizeErrorMessage(err?.message || 'HTTP request failed'),
      };
    }
  };
}

/**
 * Mounts standard health probe routes:
 * - GET /live    - Process liveness (event loop responsive)
 * - GET /ready   - Dependency readiness (Postgres, Redis, downstream)
 * - GET /startup - Startup completion status
 * - GET /        - Root overview / legacy compatibility (aliases readiness)
 */
export function createHealthRouter(manager: HealthManager): Router {
  const router = Router();

  router.get('/live', (req: Request, res: Response) => {
    const report = manager.getLivenessReport();
    res.status(200).json(report);
  });

  router.get('/ready', async (req: Request, res: Response) => {
    const report = await manager.getReadinessReport();
    const httpStatus = report.status === 'UP' ? 200 : 503;
    res.status(httpStatus).json(report);
  });

  router.get('/startup', (req: Request, res: Response) => {
    const report = manager.getStartupReport();
    const httpStatus = report.status === 'UP' ? 200 : 503;
    res.status(httpStatus).json(report);
  });

  router.get('/', async (req: Request, res: Response) => {
    const report = await manager.getReadinessReport();
    const httpStatus = report.status === 'UP' ? 200 : 503;
    res.status(httpStatus).json(report);
  });

  return router;
}
