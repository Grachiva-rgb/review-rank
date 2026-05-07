'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();

  const handleBack = () => {
    // history.back() is a no-op when the user arrived via direct link (no history entry).
    // Fall back to the homepage if there's no previous page to return to.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleBack}
        className="text-[#7A6B63] hover:text-[#241C15] text-sm transition-colors"
      >
        ← Back to results
      </button>
      <span className="text-[#D9CEC8] select-none">·</span>
      <Link href="/" className="text-[#7A6B63] hover:text-[#241C15] text-sm transition-colors">
        Home
      </Link>
    </div>
  );
}
