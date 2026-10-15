import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { secretMatches } from '@/lib/timingSafe';

/**
 * Revalidates the middleware's HTTP Basic Auth credentials at the page boundary.
 * Middleware is still responsible for issuing the browser's Basic Auth challenge.
 */
export function hasValidAdminCredentials(
  authorization: string | null | undefined,
  adminSecret: string | undefined
): boolean {
  if (!adminSecret || !authorization?.startsWith('Basic ')) return false;

  try {
    const decoded = atob(authorization.slice(6));
    const colonIdx = decoded.indexOf(':');
    const password = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
    return secretMatches(password, adminSecret);
  } catch {
    // Malformed Basic Auth credentials fail closed.
    return false;
  }
}

export async function requireAdminAuthorization(): Promise<void> {
  const requestHeaders = await headers();
  if (!hasValidAdminCredentials(requestHeaders.get('authorization'), process.env.ADMIN_SECRET)) {
    notFound();
  }
}
