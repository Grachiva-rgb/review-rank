import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for ReviewRank mobile app.
 *
 * Architecture: server.url mode — the native WebView loads the deployed
 * Vercel URL. This keeps all API routes (including the Google Places API
 * key) server-side. Updates deploy to Vercel without requiring an app
 * store release.
 *
 * Set CAPACITOR_SERVER_URL in your environment to override at build time.
 * During local development, set it to http://localhost:3000.
 */

const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://review-rank.vercel.app';
// Production alias — also accessible at: https://review-rank-1dqehwflf-isthmus.vercel.app

const config: CapacitorConfig = {
  appId: 'com.reviewrank.app',
  appName: 'ReviewRank',
  webDir: 'out',           // fallback for static asset sync; actual runtime uses server.url

  server: {
    url: serverUrl,
    cleartext: false,      // HTTPS only in production
    allowNavigation: [
      'review-rank.vercel.app',
      '*.vercel.app',
      'maps.googleapis.com',
      'lh3.googleusercontent.com',
    ],
  },

  ios: {
    contentInset: 'automatic',   // respects safe areas automatically
    allowsLinkPreview: false,
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },

  android: {
    allowMixedContent: false,    // enforce HTTPS
    captureInput: true,          // ensures keyboard appears correctly
    webContentsDebuggingEnabled: false,  // set true for debug builds only
  },

  plugins: {
    Geolocation: {
      // iOS: matching strings must appear in Info.plist (added by cap add ios)
      // Android: permissions declared in AndroidManifest.xml (added by cap add android)
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FAF7F0',   // cream background — matches app
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#8B5E3C',
    },
  },
};

export default config;
