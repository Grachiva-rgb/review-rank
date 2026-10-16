import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';

describe('production security headers', () => {
  it('restricts base URLs, object content and form targets without disabling existing scripts', async () => {
    const routes = await nextConfig.headers!();
    const global = routes.find((route) => route.source === '/(.*)');
    const csp = global?.headers.find((header) => header.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    // Full nonce/hash rollout needs a separate Next.js/ISR/native compatibility
    // exercise; this change must not silently break inline bootstrap scripts.
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain('capacitor://localhost');
    expect(csp).toContain('ionic://localhost');
    expect(csp).toContain('https://static.cloudflareinsights.com');
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it('keeps admin/API responses private and static asset caching intact', async () => {
    const routes = await nextConfig.headers!();
    expect(routes.find((route) => route.source === '/(api|admin)(.*)')?.headers)
      .toContainEqual({ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' });
    expect(routes.find((route) => route.source === '/_next/static/(.*)')?.headers)
      .toContainEqual({ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' });
  });
});
