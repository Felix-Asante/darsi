import type { NextFunction, Request, Response } from 'express';
import { isAllowedOrigin } from './cors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Sessions live in cookies, so a request that changes something must come from
 * one of our own pages. Browsers always send `Origin` on such requests; a
 * missing or foreign one is refused before anything runs.
 */
export function requireTrustedOrigin(
  origins: string[],
  webhookPaths: string[] = [],
) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(request.method)) return next();
    // Providers call webhooks from their servers; their signatures prove them instead.
    if (webhookPaths.some((path) => request.path.startsWith(path)))
      return next();
    const origin = request.headers.origin;
    if (origin && isAllowedOrigin(origin, origins)) return next();
    response.status(403).type('application/problem+json').json({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      code: 'untrusted_origin',
      instance: request.originalUrl,
    });
  };
}
