import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { config, proxy } from '../../proxy';

const ADMIN_SECRET = 'correct horse';

function request(path: string, authorization?: string): NextRequest {
  return new NextRequest(`https://reviewrank.example${path}`, {
    headers: authorization ? { authorization } : undefined,
  });
}

function basicAuth(password: string, username = 'admin'): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

describe('admin proxy authorization', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 when ADMIN_SECRET is not configured, even with valid credentials', async () => {
    vi.stubEnv('ADMIN_SECRET', '');

    const response = proxy(request('/admin/leads', basicAuth(ADMIN_SECRET)));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Admin access is not configured.',
    });
  });

  it.each([
    ['missing authorization', undefined],
    ['wrong password', basicAuth('wrong password')],
    ['malformed base64', 'Basic !!!not-base64!!!'],
    ['non-Basic authorization', 'Bearer some-token'],
  ])('returns a Basic Auth challenge for %s', (_scenario, authorization) => {
    vi.stubEnv('ADMIN_SECRET', ADMIN_SECRET);

    const response = proxy(request('/admin/reports', authorization));

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe(
      'Basic realm="ReviewRank Admin", charset="UTF-8"'
    );
  });

  it('accepts the configured password regardless of the Basic Auth username', () => {
    vi.stubEnv('ADMIN_SECRET', ADMIN_SECRET);

    const response = proxy(request('/admin/leads', basicAuth(ADMIN_SECRET, 'any-user')));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('bypasses authorization for non-admin paths', () => {
    vi.stubEnv('ADMIN_SECRET', ADMIN_SECRET);

    const response = proxy(request('/about'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('does not authorize using admin or secret query parameters', () => {
    vi.stubEnv('ADMIN_SECRET', ADMIN_SECRET);

    const response = proxy(
      request(`/admin/leads?admin=true&secret=${encodeURIComponent(ADMIN_SECRET)}`)
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe(
      'Basic realm="ReviewRank Admin", charset="UTF-8"'
    );
  });

  it('retains the admin-only route matcher', () => {
    expect(config.matcher).toEqual(['/admin/:path*']);
  });
});
