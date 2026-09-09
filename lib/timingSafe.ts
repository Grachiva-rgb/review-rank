/**
 * Constant-time comparison for secret material.
 *
 * `crypto.timingSafeEqual` is unavailable in the Edge runtime where
 * middleware.ts runs, so this is implemented with arithmetic that has no early
 * exit and works in both runtimes.
 *
 * Caveat, stated honestly: this removes the byte-by-byte early exit of `===`.
 * It cannot make the comparison perfectly constant-time, because JS string
 * indexing and V8's internal string representation are outside our control.
 * Remote timing recovery of a high-entropy secret across network jitter was
 * already impractical — this closes a theoretical gap cheaply, it is not the
 * control that makes ADMIN_SECRET safe. Secret length and rate limiting are.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  // Fold the length difference into the accumulator rather than returning
  // early, so a wrong-length guess costs the same as a wrong-value guess.
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i++) {
    // charCodeAt past the end of a string is NaN; `| 0` normalises it to 0.
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  }

  return diff === 0;
}

/**
 * True when `candidate` is a non-empty string matching a configured `secret`.
 *
 * Fails closed: if the secret is unset or empty, no candidate can ever match.
 * This is the property that keeps admin routes safe when env vars are missing.
 */
export function secretMatches(
  candidate: string | undefined | null,
  secret: string | undefined
): boolean {
  if (!secret || !candidate) return false;
  return timingSafeEqualString(candidate, secret);
}
