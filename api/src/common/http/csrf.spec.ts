import type { NextFunction, Request, Response } from 'express';
import { requireTrustedOrigin } from './csrf.js';

function run(method: string, origin?: string, path = '/students') {
  const next = vi.fn() as NextFunction;
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  const response = { status, type: vi.fn().mockReturnThis(), json } as unknown as Response;
  requireTrustedOrigin(['https://*.darsi.app'], ['/billing/webhooks/'])(
    { method, path, headers: origin ? { origin } : {}, originalUrl: `/api/v1${path}` } as Request,
    response,
    next,
  );
  return { next, status, json };
}

describe('requireTrustedOrigin', () => {
  it('lets reads through and writes from our own pages', () => {
    expect(run('GET').next).toHaveBeenCalled();
    expect(run('POST', 'https://greenfield.darsi.app').next).toHaveBeenCalled();
  });

  it('refuses writes from elsewhere or without an origin', () => {
    for (const origin of ['https://evil.example', undefined]) {
      const { next, status, json } = run('POST', origin);
      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'untrusted_origin' }));
    }
  });

  it('leaves signed provider webhooks to their own checks', () => {
    expect(run('POST', undefined, '/billing/webhooks/stripe').next).toHaveBeenCalled();
  });
});
