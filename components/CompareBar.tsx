'use client';

import Link from 'next/link';
import { useCompare } from '@/hooks/useCompare';

/**
 * CompareBar — sticky floating bar that appears at the bottom of the screen
 * when 1 or 2 businesses are selected for comparison.
 */
export default function CompareBar() {
  const { items, clearCompare, compareUrl } = useCompare();

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 flex justify-center pb-4 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-[#2F6F4E]/20 bg-white shadow-xl shadow-black/10 px-4 py-3 flex items-center gap-3">
        {/* Slots */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {items.map((item, i) => (
            <div
              key={item.placeId}
              className="flex items-center gap-1.5 rounded-xl bg-[#F0F7F4] border border-[#2F6F4E]/20 px-2.5 py-1.5 min-w-0 max-w-[45%]"
            >
              <span className="text-[10px] font-bold text-[#2F6F4E] flex-shrink-0">{i + 1}</span>
              <span className="text-xs text-[#241C15] truncate">{item.name}</span>
            </div>
          ))}
          {items.length === 1 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-[#D9CEC8] px-2.5 py-1.5 min-w-0 max-w-[45%]">
              <span className="text-xs text-[#B8A89F]">Pick a 2nd business</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={clearCompare}
            className="text-xs text-[#9A8C85] hover:text-[#5A4A3F] transition-colors px-2 py-1.5 min-h-[36px]"
          >
            Clear
          </button>
          {compareUrl ? (
            <Link
              href={compareUrl}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2F6F4E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#265C41] transition-colors min-h-[36px]"
            >
              Compare
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#D9CEC8] px-4 py-2 text-sm font-semibold text-white cursor-not-allowed min-h-[36px]"
            >
              Compare
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
