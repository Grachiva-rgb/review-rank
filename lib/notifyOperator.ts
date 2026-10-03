/**
 * Operator alerts for money events.
 *
 * Before this existed, report requests and leads landed in admin pages
 * nobody was pinged to visit, unmatched leads were invisible, and failed
 * partner deliveries were written to lead_deliveries and never read — all
 * four were silent revenue loss. Every send here is fire-and-forget and
 * must never block or fail the user-facing request.
 *
 * Requires OPERATOR_ALERT_EMAIL (and the existing RESEND_API_KEY). When
 * either is absent, falls back to console.error so the event at least
 * appears in function logs.
 */

const FROM_FALLBACK = 'ReviewRank Alerts <leads@reviewrank.app>';

export async function notifyOperator(subject: string, lines: string[]): Promise<void> {
  const to = process.env.OPERATOR_ALERT_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const body = lines.join('\n');

  if (!to || !apiKey) {
    console.error(`[operator-alert:unsent] ${subject}\n${body}`);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_ADDRESS || FROM_FALLBACK,
        to,
        subject: `[ReviewRank] ${subject}`,
        text: body,
      }),
    });
    if (!res.ok) {
      console.error(`[operator-alert:failed] ${res.status} ${subject}`);
    }
  } catch (err) {
    console.error('[operator-alert:error]', subject, err);
  }
}
