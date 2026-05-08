'use client';

import { useCompare, CompareItem } from '@/hooks/useCompare';

interface CompareButtonProps {
  business: CompareItem;
  size?: 'sm' | 'md';
}

export default function CompareButton({ business, size = 'md' }: CompareButtonProps) {
  const { isComparing, toggleCompare, isFull } = useCompare();

  const selected = isComparing(business.placeId);
  const disabled = isFull && !selected;

  const btnClass =
    size === 'sm'
      ? 'flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors min-h-[36px]'
      : 'flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors min-h-[44px]';

  const colorClass = selected
    ? 'border-[#2F6F4E]/40 bg-[#2F6F4E]/5 text-[#2F6F4E]'
    : disabled
    ? 'border-[#D9CEC8] bg-white text-[#C2C2C2] cursor-not-allowed'
    : 'border-[#D9CEC8] bg-white text-[#7A6B63] hover:border-[#2F6F4E]/40 hover:text-[#2F6F4E]';

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && toggleCompare(business)}
      aria-label={selected ? 'Remove from comparison' : 'Add to comparison'}
      title={disabled ? 'Remove one to compare another' : undefined}
      className={`${btnClass} ${colorClass}`}
    >
      {/* Two overlapping squares icon */}
      <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {selected ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        )}
      </svg>
      {selected ? 'Added' : 'Compare'}
    </button>
  );
}
