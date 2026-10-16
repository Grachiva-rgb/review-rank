import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { config, proxy } from '../../proxy';

const limiter = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock('../ratelimit', async (importOriginal) => ({
  ...await importOriginal<typeof import('../ratelimit')>(),
  rateLimitAsync: limiter.check,
}));

const ADMIN_SECRET = 'correct horse';

function request(path: string, authorization?: string): NextRequest {
  return new NextRequest(`https://reviewrank.example${path}`, {
    headers: { 'x-real-ip': '192.0.2.42', ...(authorization ? { authorization } : {}) },
  });
}

function basicAuth(password: string, username = 'admin'): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

describe('admin proxy authorization', () => {
  beforeEach(() => {
    limiter.check.mockReset();
    limiter.check.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 when ADMIN_SECRET is not configured, even with valid credentials', async () => {
    vi.stubEnv('ADMIN_SECRET', '');

    const response = await proxy(request('/admin/leads', basicAuth(ADMIN_SECRET)));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Admin access is not configured.',
    });
    expect(limiter.check).not.toHaveBeenCalled();
  });

  it.each([
    ['missing authorization', undefined],
    ['wrong password', basicAuth('wrong password')],
    ['malformed base64', 'Basic !!!not-base64!!!'],
    ['non-Basic authorization', 'Bearer some-token'],
  ])('returns a Basic Auth challenge for %s', async (_scenario, authorization) => {
    vi.stubEnv('ADMIN_SECRET', ADMIN_SECRET);

    const response = await proxy(request('/admin/reports', authorization));

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe(
      'Basic realm="ReviewRank Admin", charset="UTF-8"'
    );
  });

  it('accepts the configured password regardless of the Basic Auth username', async () => {
    vi.stubEnv('ADMIN_SECRET', ADMIN_SECRET);

    const response = await proxy(request('/admin/leads', basicAuth(ADMIN_SECRET, 'any-user')));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(limiter.check).toHaveBeenCalledWith('admin:192.0.2.42', 30, 60_000);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('bypasses authorization for non-admin paths', async () => {
    vi.stubEnv('ADMIN_SECRET', ADMIN_SECRET);

    const response = await proxy(request('/about'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(limiter.check).not.toHaveBeenCalled();
  });

  it('does not authorize using admin or secret query parameters', async () => {
    vi.stubEnv('ADMIN_SECRET', ADMIN_SECRET);

    const response = await proxy(
      request(`/admin/leads?admin=true&secret=${encodeURIComponent(ADMIN_SECRET)}`)
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe(
      'Basic realm="ReviewRank Admin", charset="UTF-8"'
    );
  });

  it('does not let correct credentials bypass an exhausted attempt budget', async () => {
    vi.stubEnv('ADMIN_SECRET', ADMIN_SECRET);
    limiter.check.mockResolvedValue({ allowed: false });
    const response = await proxy(request('/admin/leads', basicAuth(ADMIN_SECRET)));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.has('WWW-Authenticate')).toBe(false);
  });

  it('fails closed when shared access protection is unavailable', async () => {
    vi.stubEnv('ADMIN_SECRET', ADMIN_SECRET);
    limiter.check.mockResolvedValue({ allowed: false, unavailable: true });
    const response = await proxy(request('/admin/leads', basicAuth(ADMIN_SECRET)));
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('throttles business rendering before metadata without requiring admin credentials', async () => {
    vi.stubEnv('ADMIN_SECRET', '');
    const response = await proxy(request('/business/fixture-place-id'));
    expect(response.status).toBe(200);
    expect(limiter.check).toHaveBeenCalledWith('business-details:192.0.2.42',30,60_000);
    expect(response.headers.has('Cache-Control')).toBe(false);
  });

  it('rejects exhausted business requests without a Basic challenge', async () => {
    limiter.check.mockResolvedValue({ allowed: false });
    const response = await proxy(request('/business/fixture-place-id'));
    expect(response.status).toBe(429);
    expect(response.headers.has('WWW-Authenticate')).toBe(false);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('retains only the admin/business route matchers', () => {
    expect(config.matcher).toEqual(['/admin/:path*','/business/:path*']);
  });
});
