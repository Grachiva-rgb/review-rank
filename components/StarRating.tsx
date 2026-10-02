interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ rating, size = 'md' }: StarRatingProps) {
  const sizeClass = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm';

  // Fail safe on bad input: NaN/undefined/negative render as 0 stars (all
  // grey), values above 5 cap at 5. Without the cap, any future caller that
  // accidentally passed a 0–100 score here would render five filled stars
  // next to a contradicting number.
  const safe = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;

  return (
    <div className={`flex items-center gap-0.5 ${sizeClass}`} aria-label={`${safe} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.floor(safe);
        const half = !filled && star <= safe + 0.5;
        return (
          <span
            key={star}
            className={filled ? 'text-[#F4B400]' : half ? 'text-[#F4B400]/50' : 'text-[#DDD3CB]'}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}
