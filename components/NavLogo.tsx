/**
 * NavLogo — pin icon + "Review Rank" wordmark.
 * Use in every nav bar. Handles responsive sizing via `size` prop.
 */

interface NavLogoProps {
  /** 'md' for standard nav (default), 'sm' for compact/admin navs */
  size?: 'sm' | 'md';
}

export default function NavLogo({ size = 'md' }: NavLogoProps) {
  const textSize  = size === 'sm' ? 'text-lg'  : 'text-xl';
  const iconW     = size === 'sm' ? 15         : 17;
  const iconH     = size === 'sm' ? 19         : 21;

  return (
    <span
      className={`font-display ${textSize} tracking-tight text-[#241C15] flex items-center gap-[7px] select-none`}
      style={{ letterSpacing: '-0.01em' }}
    >
      {/* Verified-pin icon */}
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 30 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0, marginBottom: 1 }}
      >
        {/* Pin body */}
        <path
          d="M15 0.5C6.992 0.5 0.5 6.992 0.5 15c0 10.2 14.5 20.8 14.5 20.8S29.5 25.2 29.5 15C29.5 6.992 23.008 0.5 15 0.5z"
          fill="#8B5E3C"
        />
        {/* Inner white circle for depth */}
        <circle cx="15" cy="14.5" r="9" fill="white" opacity="0.97" />
        {/* Checkmark */}
        <path
          d="M10 14.5l3.5 3.5 7-7"
          stroke="#8B5E3C"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Wordmark — "Review" dark, "Rank" copper */}
      <span style={{ letterSpacing: '-0.015em' }}>
        Review<span className="text-[#8B5E3C]" style={{ letterSpacing: '-0.01em' }}>Rank</span>
      </span>
    </span>
  );
}
