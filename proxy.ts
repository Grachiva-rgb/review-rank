import { NextRequest, NextResponse } from 'next/server';
import { secretMatches } from '@/lib/timingSafe';
import { clientIp, rateLimitAsync } from '@/lib/ratelimit';

/**
 * Admin authentication via HTTP Basic Auth.
 *
 * Any request to /admin/* is challenged with a browser-native credentials
 * dialog. The password is compared against ADMIN_SECRET.
 *
 * This replaces the previous ?secret=<ADMIN_SECRET> URL-parameter approach,
 * which leaked the secret into browser history, server logs, CDN access logs,
 * and rendered HTML.
 */
async function handleAdminAuth(request: NextRequest): Promise<NextResponse | null> {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return NextResponse.json(
      { error: 'Admin access is not configured.' },
      { status: 503 }
    );
  }

  // Count attempts BEFORE comparing credentials: a correct guess must not bypass
  // an exhausted budget. Valid admin navigation uses the same 30/minute budget.
  const verdict = await rateLimitAsync(`admin:${clientIp(request)}`, 30, 60_000);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: verdict.unavailable ? 'Admin access protection is unavailable.' : 'Too many admin access attempts.' },
      { status: verdict.unavailable ? 503 : 429, headers: { 'Retry-After': '60' } }
    );
  }

  const auth = request.headers.get('authorization') ?? '';

  if (auth.startsWith('Basic ')) {
    try {
      const encoded = auth.slice(6);
      const decoded = atob(encoded); // Available in the Node.js proxy runtime.
      const colonIdx = decoded.indexOf(':');
      const password = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
      // Constant-time compare: `===` exits on the first differing byte.
      if (secretMatches(password, adminSecret)) return null; // authenticated
    } catch {
      // malformed base64 — fall through to 401
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ReviewRank Admin", charset="UTF-8"',
    },
  });
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const authResult = await handleAdminAuth(request);
    const response = authResult ?? NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    return response;
  }

  // Run before BOTH metadata and page rendering, without adding headers() to
  // the business page (which would disable its daily ISR and harm caching/SEO).
  if (pathname.startsWith('/business/')) {
    const verdict = await rateLimitAsync(`business-details:${clientIp(request)}`, 30, 60_000);
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: verdict.unavailable ? 'Request protection is unavailable.' : 'Too many business requests.' },
        {
          status: verdict.unavailable ? 503 : 429,
          headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' },
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/business/:path*'],
};
