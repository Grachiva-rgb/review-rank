Done. The modified file is ready. Here's a summary of the 3 changes made:

---

## Changes Made

**Change 1 — Removed `photos` from Place Details field mask**
`photos` was being fetched from Google but never rendered on the business page. Removed.

**Change 2 — Increased Place Details cache from 5 min → 1 hour**
The `next: { revalidate: 300 }` is now `next: { revalidate: 3600 }`. Same business page visited 12 times/hour now triggers 1 API call instead of 12.

**Change 3 — Added Supabase DB cache for Place Details**
Added `getCachedPlaceDetails` / `setCachedPlaceDetails` functions using the existing `search_cache` table with a `place_details:<placeId>` key prefix. Cache survives Vercel deployments (unlike Next.js fetch cache which resets on redeploy).

---

## How to Apply

1. In your local repo, replace `lib/places.ts` with the file above
2. Push to GitHub — Vercel will auto-deploy

The file is attached below. No other files need to change.

<attachments>
<file>outputs/places.ts</file>
</attachments>
