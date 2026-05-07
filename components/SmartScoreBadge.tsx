import { getScoreColor, getScoreBgColor, getScoreLabel } from '@/lib/ranking';

interface SmartScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function SmartScoreBadge({ score, size = 'md' }: SmartScoreBadgeProps) {
  const color = getScoreColor(score);
  const bg = getScoreBgColor(score);

  if (size === 'lg') {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl border-2 ${bg} px-6 py-4 min-w-[110px]`}>
        <span className={`font-mono text-4xl font-bold leading-none tabular-nums ${color}`}>
          {score.toFixed(1)}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${color} opacity-70`}>
          {getScoreLabel(score)}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-[#9A8C85] mt-0.5">Smart Score</span>
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center font-mono text-xs font-bold tabular-nums ${color}`}>
        {score.toFixed(1)}
      </span>
    );
  }

  // Default 'md' — used in BusinessCard
  return (
    <div
      className="flex flex-col items-center"
      title={`Smart Score: ${score.toFixed(1)} — combines star rating with review volume (max ~20)`}
    >
      <div className={`flex items-center justify-center rounded-xl border-2 ${bg} w-14 h-14`}>
        <span className={`font-mono text-xl font-bold leading-none tabular-nums ${color}`}>
          {score.toFixed(1)}
        </span>
      </div>
      <span className="text-[9px] uppercase tracking-widest text-[#9A8C85] mt-1 font-semibold">
        Smart Score
      </span>
    </div>
  );
}
