'use client';

import { SortFilter } from '@/lib/types';

interface FilterBarProps {
  currentFilter: SortFilter;
  onFilterChange: (filter: SortFilter) => void;
  count: number;
}

const FILTERS: { value: SortFilter; label: string; title: string }[] = [
  {
    value: 'smart_score',
    label: 'Most Trusted',
    title: 'Balances rating quality with review volume — the most reliable overall ranking',
  },
  {
    value: 'rating',
    label: 'Highest Rated',
    title: 'Sort by star rating',
  },
  {
    value: 'reviews',
    label: 'Most Reviewed',
    title: 'Sort by total review count — indicates established, widely-used businesses',
  },
  {
    value: 'rising_stars',
    label: 'Rising Stars',
    title: 'High ratings with under 500 reviews — strong early signals',
  },
];

export default function FilterBar({ currentFilter, onFilterChange, count }: FilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-[#5A4A3F] flex-shrink-0">
          <span className="font-mono text-[#241C15] font-semibold">{count}</span>{' '}
          {count === 1 ? 'business' : 'businesses'} found
        </p>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-[#7A6B63] flex-shrink-0 mr-1">Sort by:</span>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              title={f.title}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
                currentFilter === f.value
                  ? 'bg-[#8B5E3C]/10 border-[#8B5E3C]/40 text-[#8B5E3C]'
                  : 'bg-white border-[#EDE8E3] text-[#5A4A3F] hover:text-[#241C15] hover:border-[#D9CEC8]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contextual explanation — adapts to active sort */}
      {currentFilter === 'smart_score' && (
        <p className="text-xs text-[#7A6B63] bg-[#FAF7F0] border border-[#EDE8E3] rounded-lg px-3 py-2">
          <span className="font-medium text-[#5A4A3F]">Most Trusted</span> ranks by Smart Score —
          a formula that balances star rating with review volume so that a business with 4.7★ across
          2,000 reviews outranks one with 4.9★ across 5 reviews.
        </p>
      )}
      {currentFilter === 'rating' && (
        <p className="text-xs text-[#7A6B63] bg-[#FAF7F0] border border-[#EDE8E3] rounded-lg px-3 py-2">
          <span className="font-medium text-[#5A4A3F]">Highest Rated</span> sorts purely by star
          rating. Note: a 4.9★ business with 3 reviews will rank above a 4.7★ business with 2,000
          reviews — which may not reflect real-world reliability. Consider switching to{' '}
          <button
            onClick={() => onFilterChange('smart_score')}
            className="underline text-[#8B5E3C] hover:text-[#6B4A2F]"
          >
            Most Trusted
          </button>{' '}
          for a more balanced ranking.
        </p>
      )}
      {currentFilter === 'reviews' && (
        <p className="text-xs text-[#7A6B63] bg-[#FAF7F0] border border-[#EDE8E3] rounded-lg px-3 py-2">
          <span className="font-medium text-[#5A4A3F]">Most Reviewed</span> sorts by total review
          count. High volume doesn&apos;t always mean high quality — a business with thousands of
          reviews at 3.8★ will appear at the top. Check the star rating alongside the review count.
        </p>
      )}
      {currentFilter === 'rising_stars' && (
        <p className="text-xs text-[#7A6B63] bg-[#FAF7F0] border border-[#EDE8E3] rounded-lg px-3 py-2">
          <span className="font-medium text-[#5A4A3F]">Rising Stars</span> surfaces businesses with
          high ratings but fewer than 500 reviews — strong early signals before they become
          widely known.
        </p>
      )}
    </div>
  );
}
