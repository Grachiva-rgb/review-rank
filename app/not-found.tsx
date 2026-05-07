import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="font-mono text-5xl text-[#D9CEC8] mb-4">404</p>
        <p className="text-[#241C15] font-medium mb-1">Page not found</p>
        <p className="text-[#7A6B63] text-sm mb-6">This page doesn&apos;t exist or has moved.</p>
        <Link
          href="/"
          className="text-sm text-[#8B5E3C] hover:text-[#6B4A2F] transition-colors"
        >
          ← Back to search
        </Link>
      </div>
    </div>
  );
}
