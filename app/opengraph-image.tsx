import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ReviewRank — Find the places locals trust most';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAF7F0',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        }}
      >
        {/* Subtle radial gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,94,60,0.10), transparent)',
          }}
        />

        {/* Trust badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(47,111,78,0.08)',
            border: '1px solid rgba(47,111,78,0.20)',
            borderRadius: '999px',
            padding: '8px 20px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#2F6F4E',
            }}
          />
          <span style={{ color: '#2F6F4E', fontSize: '16px', fontFamily: 'monospace' }}>
            No paid rankings · Based on public review signals
          </span>
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: 'flex',
            fontSize: '80px',
            fontWeight: '700',
            letterSpacing: '-2px',
            marginBottom: '24px',
          }}
        >
          <span style={{ color: '#241C15' }}>Review</span>
          <span style={{ color: '#8B5E3C' }}>Rank</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            color: '#5A4A3F',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: '1.4',
          }}
        >
          Find the places locals trust most.
        </div>

        {/* Sub-tagline */}
        <div
          style={{
            fontSize: '18px',
            color: '#7A6B63',
            textAlign: 'center',
            maxWidth: '600px',
            marginTop: '16px',
          }}
        >
          Ranked by review quality, volume, and consistency — not star averages.
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            fontSize: '16px',
            color: '#9A8C85',
            fontFamily: 'monospace',
          }}
        >
          reviewrank.app
        </div>
      </div>
    ),
    { ...size }
  );
}
