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
  title: 'ReviewRank — Find the Places Locals Trust Most',
  description:
    'Discover top-ranked local businesses using a smart scoring algorithm that weighs both rating quality and review volume.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'ReviewRank',
    description: 'Find the places locals trust most, ranked by real customer signals.',
    type: 'website',
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
