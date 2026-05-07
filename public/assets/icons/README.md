# App Icon & Splash Screen Assets

Place the following source files in this directory before running `cap sync`.
Capacitor (via `@capacitor/assets`) will generate all required size variants.

## Required source files

| File | Size | Format | Purpose |
|------|------|--------|---------|
| `icon.png` | 1024×1024 px | PNG, no transparency | App icon (iOS + Android) |
| `icon-foreground.png` | 1024×1024 px | PNG, with transparency | Android adaptive icon foreground |
| `icon-background.png` | 1024×1024 px | PNG, solid colour | Android adaptive icon background |
| `splash.png` | 2732×2732 px | PNG | Splash screen (all sizes) |
| `splash-dark.png` | 2732×2732 px | PNG | Splash screen (dark mode, optional) |

## Design guidelines

**Icon**
- Background: `#FAF7F0` (cream) or `#8B5E3C` (copper) — test both
- Foreground: the verified-pin SVG centered at ~60% of the canvas
- Add 10–15% padding around the edges (Apple and Google crop to circles/squircles)
- Do not add text to the icon

**Splash screen**
- Background fill: `#FAF7F0`
- Centred logo mark (pin icon only, ~15% of canvas width)
- No text on splash — keep it clean

## Generating all sizes

Install the Capacitor assets tool:

```bash
npm install -D @capacitor/assets
```

Then run from the project root:

```bash
npx capacitor-assets generate --assetPath public/assets/icons
```

This generates:
- All iOS icon sizes in `ios/App/App/Assets.xcassets/`
- All Android icon sizes in `android/app/src/main/res/`
- Splash screen images for both platforms

## App Store icon requirements (Apple)
- 1024×1024 px PNG, no transparency, no rounded corners (App Store Connect applies the mask)
- iOS 18+: a dark and tinted variant are recommended but not required

## Play Store icon requirements (Google)
- 512×512 px PNG for the store listing
- Android adaptive icons: the foreground/background pair handles all device shapes
