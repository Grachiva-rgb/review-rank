interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ rating, size = 'md' }: StarRatingProps) {
  const sizeClass = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm';

  return (
    <div className={`flex items-center gap-0.5 ${sizeClass}`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.floor(rating);
        const half = !filled && star <= rating + 0.5;
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
