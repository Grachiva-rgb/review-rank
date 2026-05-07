# ReviewRank

Find the places locals trust most — ranked by real customer reviews, not paid placements.

Built with Next.js 15 · Deployed on Vercel · Native mobile via Capacitor (iOS + Android).

**Smart Score** = `rating × log₁₀(review_count + 1)`

---

## Architecture

ReviewRank uses Capacitor's **`server.url` mode**: the native apps load the deployed
Vercel URL inside a native WebView. The Google Places API key stays protected on the
server. App updates go live the moment you deploy to Vercel — no new App Store release
required for content changes.

```
[iOS App / Android App]
        │
   Capacitor WebView
        │
   https://your-app.vercel.app   ← Next.js on Vercel
        │
   /api/places ──────── Google Places API  (key server-side only)
   /api/lead-request ── Supabase
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | |
| Xcode | 15+ | macOS only, required for iOS |
| Android Studio | Hedgehog+ | Required for Android |
| Vercel account | — | Free tier works |
| Apple Developer Program | $99/year | Required for App Store |
| Google Play Console | $25 one-time | Required for Play Store |

---

## Local development

```bash
npm install
cp .env.production .env.local   # then fill in your keys
npm run dev
```

Open http://localhost:3000.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_PLACES_API_KEY` | Yes | Google Cloud Places API key |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key |
| `ADMIN_SECRET` | No | Secret for /admin/* pages |
| `CAPACITOR_SERVER_URL` | Mobile | Vercel URL loaded by the native app |

---

## Deploy to Vercel

The Capacitor mobile app loads your Vercel URL — deploy the web app first.

```bash
npm install -g vercel
vercel login
vercel --prod
```

Note the URL (e.g. `https://reviewrank-abc123.vercel.app`).

Set all environment variables in the Vercel dashboard under Project → Settings → Environment Variables.

---

## Mobile setup

### 1. Set the Capacitor server URL

Edit `capacitor.config.ts` and replace `your-app.vercel.app` with your real Vercel URL.

### 2. Add native platforms (run once on your dev machine)

```bash
npx cap add ios
npx cap add android
```

### 3. Sync after any config change

```bash
npm run cap:sync
```

---

## iOS — App Store build

### Requirements
- macOS with Xcode 15+
- Apple Developer Program membership

### Steps

```bash
npm run cap:ios       # opens Xcode
```

In Xcode:

1. **Team & signing** — select your Apple Developer team in Signing & Capabilities
2. **Bundle ID** — must match `appId` in `capacitor.config.ts` (`com.reviewrank.app`)
3. **Location permissions** — verify these keys exist in `ios/App/App/Info.plist`
   (the Geolocation plugin adds them, but check the description strings):

   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>ReviewRank uses your location to find trusted businesses near you.</string>
   ```

4. **App icons** — see `public/assets/icons/README.md` to generate all required sizes
5. **Archive** — Product → Archive → Distribute App → App Store Connect

### TestFlight (recommended before release)

Upload via Xcode Organizer → Distribute → App Store Connect.
Then invite testers from App Store Connect → TestFlight.

---

## Android — Google Play build

### Requirements
- Android Studio (Hedgehog or later)
- Java 17+
- Google Play Console account

### Steps

```bash
npm run cap:android   # opens Android Studio
```

In Android Studio:

1. **App ID** — matches `appId` in `capacitor.config.ts` (`com.reviewrank.app`)
2. **Location permissions** — verify these exist in `android/app/src/main/AndroidManifest.xml`:

   ```xml
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-permission android:name="android.permission.INTERNET" />
   ```

3. **App icons** — see `public/assets/icons/README.md` to generate adaptive icons
4. **Signing** — Build → Generate Signed Bundle/APK → Android App Bundle (.aab)
   - Create a new keystore (back it up — you need it for every future update)
5. **Upload** — Google Play Console → Create app → Production → Upload AAB

---

## Updating the app after release

| Change type | Steps |
|-------------|-------|
| UI / content / ranking logic | Push to main → Vercel auto-deploys → users see it immediately |
| New Capacitor plugin | `npm install @capacitor/plugin` → `npx cap sync` → rebuild in Xcode/Android Studio → submit new binary |
| App name, icon, permissions | Update config → `npx cap sync` → rebuild and submit new binary |

---

## App icons and splash screens

See `public/assets/icons/README.md` for source file requirements and generation steps.

Quick reference:
```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --assetPath public/assets/icons
```

---

## Project structure

```
review-rank/
├── app/
│   ├── api/                    Server-side API routes (Places, leads, reports)
│   ├── business/[id]/          Business detail page
│   ├── results/                Search results page
│   ├── admin/                  Admin panels (leads, report requests)
│   └── page.tsx                Homepage
├── components/                 Shared UI components
│   ├── NavLogo.tsx             Logo mark — single source of truth
│   ├── BusinessCard.tsx        Search result card with quote CTA
│   ├── QuoteButton.tsx         Lead capture modal
│   └── SearchForm.tsx          Search form with Capacitor Geolocation
├── lib/
│   ├── places.ts               Google Places API client
│   ├── ranking.ts              Smart Score + trust tier logic
│   └── types.ts                TypeScript types
├── public/
│   ├── assets/icons/           Source images for app icons and splash screens
│   └── favicon.svg             Browser favicon (copper pin mark)
├── supabase/migrations/        Database schema
├── capacitor.config.ts         Capacitor configuration
├── next.config.ts              Next.js config (CSP, image domains)
└── .env.production             Environment variable template
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run cap:sync` | Sync Capacitor config and plugins |
| `npm run cap:ios` | Open iOS project in Xcode |
| `npm run cap:android` | Open Android project in Android Studio |
| `npm run cap:copy` | Copy web assets to native projects |

---

## Google Places API setup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create credentials → API key
3. Enable **Places API (New)** under APIs & Services → Library
4. Restrict the key to your Vercel domain under key settings
5. Set `GOOGLE_PLACES_API_KEY` in Vercel environment variables

---

## Supabase setup (optional)

Used for lead requests (`/api/lead-request`) and report submissions (`/api/report-request`).

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in the SQL editor:
   - `supabase/migrations/0002_business_report_requests.sql`
   - `supabase/migrations/0003_leads.sql`
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel
