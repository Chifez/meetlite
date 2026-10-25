import { PrismaClient } from '@prisma/client';
import { formatPooledDatabaseUrl } from './database/connection-config.js';

export interface PrismaClientOptions {
  connectionLimit?: number;
  poolTimeout?: number;
  processRole?: string;
  log?: ('query' | 'error' | 'warn' | 'info')[];
}

export function createPrismaClient(options: PrismaClientOptions = {}): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;
  const formattedUrl = rawUrl
    ? formatPooledDatabaseUrl(rawUrl, {
        connectionLimit: options.connectionLimit,
        poolTimeout: options.poolTimeout,
        role: options.processRole,
      })
    : undefined;

  const defaultLogs: ('query' | 'error' | 'warn')[] =
    process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'];

  return new PrismaClient({
    log: options.log || defaultLogs,
    datasources: formattedUrl
      ? {
          db: {
            url: formattedUrl,
          },
        }
      : undefined,
  });
}

export const prisma = createPrismaClient();

export * from '@prisma/client';
