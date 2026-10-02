import { getScoreBand } from '@/lib/scoreBands';

/**
 * Badge rendering the 0–100 ReviewRank Score. Colour, label and hover title
 * come from the central band map in lib/scoreBands — this component must not
 * define its own thresholds.
 *
 * Legacy data: saved-list entries written before the 0–100 ReviewRank Score
 * may still carry the old 0–7.5 Smart Score. Those render as a neutral
 * "outdated" badge rather than being mapped through either band table —
 * the old table produced labels (e.g. "Well Trusted") that no longer exist
 * anywhere in the product.
 */

interface SmartScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string; // optional caption override
}

export default function SmartScoreBadge({ score, size = 'md', label }: SmartScoreBadgeProps) {
  // A current 0–100 score in the meaningful range is never ≤10; treat such
  // values as stale saved data from the pre-ReviewRank-Score era.
  const isLegacy = score > 0 && score <= 10;
  const band = isLegacy
    ? { label: 'Outdated', text: 'text-[#9A8C85]', bg: 'bg-[#FAF7F0] border-[#EDE8E3]' }
    : getScoreBand(score);
  const display = isLegacy ? '—' : Math.round(score).toString();
  const caption = label ?? 'ReviewRank Score';
  const title = isLegacy
    ? 'Saved before the current scoring model — open the business page for a current score'
    : `ReviewRank Score: ${display}/100 — ${band.label}`;

  if (size === 'lg') {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl border-2 ${band.bg} px-6 py-4 min-w-[120px]`} title={title}>
        <div className="flex items-baseline">
          <span className={`font-mono text-4xl font-bold leading-none tabular-nums ${band.text}`}>{display}</span>
          {!isLegacy && <span className={`font-mono text-sm ml-1 ${band.text} opacity-60`}>/100</span>}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${band.text} opacity-80`}>{band.label}</span>
        <span className="text-[10px] uppercase tracking-widest text-[#9A8C85] mt-0.5">{caption}</span>
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center font-mono text-xs font-bold tabular-nums ${band.text}`} title={title}>
        {display}{!isLegacy && <span className="opacity-60">/100</span>}
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
