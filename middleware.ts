import { NextRequest, NextResponse } from 'next/server';

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
function handleAdminAuth(request: NextRequest): NextResponse | null {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return NextResponse.json(
      { error: 'Admin access is not configured.' },
      { status: 503 }
    );
  }

  const auth = request.headers.get('authorization') ?? '';

  if (auth.startsWith('Basic ')) {
    try {
      const encoded = auth.slice(6);
      const decoded = atob(encoded); // Web API — available in Next.js Edge Runtime
      const colonIdx = decoded.indexOf(':');
      const password = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
      if (password === adminSecret) return null; // authenticated — allow through
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

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const authResult = handleAdminAuth(request);
    if (authResult) return authResult;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
