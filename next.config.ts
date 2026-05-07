import type { NextConfig } from 'next';

// When running inside a Capacitor WebView the native bridge communicates via
// these schemes. They must be allowed in connect-src so the Geolocation plugin
// and bridge messaging work correctly.
const CAPACITOR_ORIGINS = [
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
].join(' ');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/maps/api/place/photo**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Static assets are content-hash named — safe to cache long-term
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          // X-Frame-Options removed: Capacitor WebView renders the page inside a native
          // frame, so DENY would prevent the app from loading on iOS/Android.
          // Framing is still prevented via the CSP frame-ancestors directive below.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Allow geolocation from self AND Capacitor origins
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              // Allow connect from self + Capacitor bridge origins + Google APIs
              `connect-src 'self' ${CAPACITOR_ORIGINS} https://places.googleapis.com https://maps.googleapis.com`,
              "img-src 'self' https://maps.googleapis.com https://lh3.googleusercontent.com data: blob:",
              // frame-ancestors replaces X-Frame-Options
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
