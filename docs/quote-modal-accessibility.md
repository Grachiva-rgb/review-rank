# Quote-modal accessibility and short-screen acceptance

This scoped follow-up is based on the exact combined staging source from PR #27.
It does not change ranking, cache policy, provider requests, lead routing, sharing
consent policy, or request payloads. Automatic Git deployment is disabled for this
test branch; any preview must explicitly select the existing staging environment.

## Required behavior

- A covered, reputation-eligible result card opens the actual quote dialog.
- Visible name, phone and description labels are associated with unique controls.
- The dialog exposes its title, modal semantics and accessible error feedback.
- Opening moves focus into the dialog. Tab and Shift+Tab stay within it.
- Close, backdrop and Escape dismiss it and restore focus to its triggering CTA.
- Background scrolling is locked only while the dialog is open and restored
  during cleanup without changing unrelated document styles.
- The panel is constrained to available height and its contents can scroll at
  360x480, 360x640, 360x800 and 1280x900; Close and Send remain reachable.
- Consent begins unchecked and required. Existing missing-field checks and
  consent/payload behavior remain unchanged.

## Verification boundaries

Focused automated tests are supplemented by real Chromium checks against the
exact deployed source. Test counts, source SHA, viewport results and access
cleanup must be recorded in the draft PR; do not infer a pass from this document.

The staging fixture has no provider review history and intentionally fails the
reputation gate. UI checks may substitute a clearly labeled, browser-only result
card while leaving partner coverage GETs real and unchanged. Such checks verify
the deployed component, not real provider search, actual ranking, native devices,
or physical on-screen-keyboard behavior. Never persist synthetic display scores.

During invalid-only checks, permit only same-origin GET/HEAD requests and assert
zero lead-request POST attempts. Never submit an otherwise valid consented form.
No additional quote, database seed, email, payment or provider key is necessary.

Temporary preview access must remain deployment-specific, be revoked afterward,
and be independently checked using anonymous access, the revoked link and the
previously issued session. A successful revoke response alone is insufficient.

No merge, production migration/deployment or native distribution is authorized.
