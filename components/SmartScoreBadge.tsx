/**
 * Badge rendering the 0–100 Review Rank Score. Colour, label and hover title
 * are derived from the score band.
 *
 * Backwards-compatible: callers that were passing the old 0–7.5 Smart Score
 * can continue to do so — scores ≤ 10 are auto-recognised and rendered with
 * the old band thresholds. New callers should pass a 0–100 score.
 */

interface SmartScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string; // optional override, e.g. "Highly Trusted"
}

function bandFor100(score: number): { text: string; bg: string; label: string } {
  if (score >= 80) return { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Elite' };
  if (score >= 65) return { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Highly Trusted' };
  if (score >= 50) return { text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     label: 'Trusted' };
  if (score >= 35) return { text: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',   label: 'Established' };
  return              { text: 'text-red-700',     bg: 'bg-red-50 border-red-200',         label: 'Limited' };
}

function bandFor10(score: number): { text: string; bg: string; label: string } {
  if (score >= 4.5) return { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Highly Trusted' };
  if (score >= 3)   return { text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     label: 'Well Trusted' };
  if (score >= 1.8) return { text: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',   label: 'Trusted' };
  if (score >= 1)   return { text: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',   label: 'Established' };
  return              { text: 'text-red-700',      bg: 'bg-red-50 border-red-200',         label: 'Limited Data' };
}

export default function SmartScoreBadge({ score, size = 'md', label }: SmartScoreBadgeProps) {
  // A 0–100 score can never be below 10 in the "good" range, so use a 10-cap
  // as the bright line between the two scales.
  const is100 = score > 10 || (score === 0);
  const band = is100 ? bandFor100(score) : bandFor10(score);
  const display = is100 ? Math.round(score).toString() : score.toFixed(1);
  const suffix = is100 ? '/100' : '';
  const caption = label ?? 'Review Rank';
  const title = `Review Rank Score: ${display}${suffix} — ${band.label}`;

  if (size === 'lg') {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl border-2 ${band.bg} px-6 py-4 min-w-[120px]`}>
        <div className="flex items-baseline">
          <span className={`font-mono text-4xl font-bold leading-none tabular-nums ${band.text}`}>{display}</span>
          {is100 && <span className={`font-mono text-sm ml-1 ${band.text} opacity-60`}>/100</span>}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${band.text} opacity-80`}>{band.label}</span>
        <span className="text-[10px] uppercase tracking-widest text-[#9A8C85] mt-0.5">{caption}</span>
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center font-mono text-xs font-bold tabular-nums ${band.text}`}>
        {display}{is100 && <span className="opacity-60">/100</span>}
      </span>
    );
  }

  // Default 'md'
  return (
    <div className="flex flex-col items-center" title={title}>
      <div className={`flex items-center justify-center rounded-xl border-2 ${band.bg} w-14 h-14`}>
        <span className={`font-mono text-xl font-bold leading-none tabular-nums ${band.text}`}>{display}</span>
      </div>
      <span className="text-[9px] uppercase tracking-widest text-[#9A8C85] mt-1 font-semibold">{caption}</span>
    </div>
  );
}
