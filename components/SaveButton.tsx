'use client';

import { useSavedBusinesses, SavedBusiness } from '@/hooks/useSavedBusinesses';

interface SaveButtonProps {
  business: Omit<SavedBusiness, 'savedAt'>;
  size?: 'sm' | 'md';
}

export default function SaveButton({ business, size = 'md' }: SaveButtonProps) {
  const { isSaved, toggleSave, hydrated } = useSavedBusinesses();

  if (!hydrated) return null;

  const saved = isSaved(business.placeId);
  const label = saved ? 'Saved' : 'Save';

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const btnClass =
    size === 'sm'
      ? 'flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors min-h-[36px]'
      : 'flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors min-h-[44px]';

  const colorClass = saved
    ? 'border-[#8B5E3C]/40 bg-[#8B5E3C]/5 text-[#8B5E3C]'
    : 'border-[#D9CEC8] bg-white text-[#7A6B63] hover:border-[#8B5E3C]/40 hover:text-[#8B5E3C]';

  return (
    <button
      type="button"
      onClick={() => toggleSave(business)}
      aria-label={saved ? 'Remove from saved' : 'Save business'}
      className={`${btnClass} ${colorClass}`}
    >
      <svg
        className={iconSize}
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      {label}
    </button>
  );
}
