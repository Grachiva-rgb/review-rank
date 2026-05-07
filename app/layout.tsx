import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Inter, Space_Mono } from 'next/font/google';
import './globals.css';
import { PostHogProvider } from '@/components/PostHogProvider';

const playfairDisplay = Playfair_Display({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

// viewport-fit=cover is required to make env(safe-area-inset-*) CSS variables
// available, which allows content to be padded correctly below the iOS notch
// and above the Android navigation bar when running inside Capacitor.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,       // disable pinch-zoom for native app feel
  userScalable: false,
  viewportFit: 'cover',  // activates safe-area-inset-* CSS env vars
  themeColor: '#FAF7F0',
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://reviewrank.app'
  ),
  title: {
    default: 'ReviewRank — Find the Places Locals Trust Most',
    template: '%s | ReviewRank',
  },
  description:
    'Find trusted local businesses ranked by review quality, volume, and consistency — not just star averages. No paid placements.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'ReviewRank — Find the Places Locals Trust Most',
    description: 'Find the places locals trust most, ranked by real customer review signals.',
    type: 'website',
    siteName: 'ReviewRank',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'ReviewRank' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReviewRank — Find the Places Locals Trust Most',
    description: 'Find trusted local businesses ranked by review quality and volume.',
    images: ['/opengraph-image'],
  },
  verification: {
    google: 'FRBA8e2k377TVHQpz1_YRgl-dH5E0HYF7Yvprpug_Zs',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${playfairDisplay.variable} ${inter.variable} ${spaceMono.variable}`}
    >
      <body className="bg-[#FAF7F0] text-[#241C15] antialiased min-h-screen">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
