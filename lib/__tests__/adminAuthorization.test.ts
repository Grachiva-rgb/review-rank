import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasValidAdminCredentials } from '../adminAuthorization.server';

const { mockHeaders } = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import AdminLeadsPage from '../../app/admin/leads/page';
import AdminReportsPage from '../../app/admin/reports/page';
import { requireAdminAuthorization } from '../adminAuthorization.server';

describe('admin authorization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('accepts a valid HTTP Basic Auth password', () => {
    const credentials = Buffer.from('admin:correct horse').toString('base64');

    expect(hasValidAdminCredentials(`Basic ${credentials}`, 'correct horse')).toBe(true);
  });

  it.each([
    ['invalid password', `Basic ${Buffer.from('admin:wrong').toString('base64')}`, 'correct horse'],
    ['missing credentials', null, 'correct horse'],
    ['malformed credentials', 'Basic !!!not-base64!!!', 'correct horse'],
  ])('rejects %s', (_case, authorization, secret) => {
    expect(hasValidAdminCredentials(authorization, secret)).toBe(false);
  });

  it('rejects valid credentials when ADMIN_SECRET is missing', () => {
    const credentials = Buffer.from('admin:correct horse').toString('base64');

    expect(hasValidAdminCredentials(`Basic ${credentials}`, undefined)).toBe(false);
    expect(hasValidAdminCredentials(`Basic ${credentials}`, '')).toBe(false);
  });

  it.each(['wrong password', 'missing header', 'missing secret'])(
    'denies both admin pages before fetching data: %s',
    async (scenario) => {
      vi.stubEnv('ADMIN_SECRET', scenario === 'missing secret' ? '' : 'correct horse');
      mockHeaders.mockResolvedValue(
        scenario === 'missing header'
          ? new Headers()
          : new Headers({
            authorization: `Basic ${Buffer.from(
              scenario === 'missing secret' ? 'admin:correct horse' : 'admin:wrong'
            ).toString('base64')}`,
          })
      );
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(requireAdminAuthorization()).rejects.toThrow('NEXT_NOT_FOUND');
      await expect(AdminLeadsPage()).rejects.toThrow('NEXT_NOT_FOUND');
      await expect(AdminReportsPage()).rejects.toThrow('NEXT_NOT_FOUND');
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it.each([AdminLeadsPage, AdminReportsPage])(
    'allows an authenticated admin page to fetch data',
    async (page) => {
      vi.stubEnv('ADMIN_SECRET', 'correct horse');
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://staging.example.invalid');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'unit-test-only');
      mockHeaders.mockResolvedValue(
        new Headers({
          authorization: `Basic ${Buffer.from('admin:correct horse').toString('base64')}`,
        })
      );
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
      vi.stubGlobal('fetch', fetchMock);

      await page();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );
});
