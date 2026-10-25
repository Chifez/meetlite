/**
 * Identity Header Stripping & Edge Ingress Hardening Middleware
 *
 * Implements S4-01 / Phase 4: Enforces zero-trust ingress by stripping any
 * client-supplied identity headers (x-user-*, x-org-id) arriving at the API Gateway.
 * Clients can never spoof user identities, roles, or tenant boundaries via plain HTTP headers.
 */

import { Request, Response, NextFunction } from 'express';

export const UNTRUSTED_IDENTITY_HEADERS = [
  'x-user-id',
  'x-user-role',
  'x-user-email',
  'x-user-name',
  'x-org-id',
  'x-organization-id',
  'x-tenant-id',
  'x-verified-principal',
  'x-meetlite-internal-assertion',
  'x-internal-assertion',
  'x-edge-assertion',
] as const;

/**
 * Express middleware to scrub untrusted caller headers on ingress
 */
export function createIdentityStrippingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const header of UNTRUSTED_IDENTITY_HEADERS) {
      if (req.headers[header]) {
        delete req.headers[header];
      }
    }
    next();
  };
}

/**
 * Proxy request hook ensuring downstream HTTP proxy requests never forward spoofed headers
 */
export function stripHeadersFromProxyReq(proxyReq: any): void {
  for (const header of UNTRUSTED_IDENTITY_HEADERS) {
    try {
      proxyReq.removeHeader(header);
    } catch {
      // Ignore if header was not present on proxyReq
    }
  }
}
