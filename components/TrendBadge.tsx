import type { TrendSignal } from '@/lib/types';

interface TrendBadgeProps {
  signal: TrendSignal;
  label: string;
  size?: 'sm' | 'md';
}

const STYLES: Record<Exclude<TrendSignal, 'insufficient_data'>, string> = {
  above_average:  'border-[#2F6F4E]/30 bg-[#2F6F4E]/5 text-[#2F6F4E]',
  below_average:  'border-amber-200 bg-amber-50 text-amber-700',
  stable:         'border-[#D9CEC8] bg-[#F7F4F0] text-[#7A6B63]',
  fast_rising:    'border-[#2F6F4E]/40 bg-[#2F6F4E]/10 text-[#2F6F4E]',
  trending_up:    'border-[#2F6F4E]/30 bg-[#2F6F4E]/5 text-[#2F6F4E]',
  trending_down:  'border-red-200 bg-red-50 text-red-700',
};

const ICONS: Record<Exclude<TrendSignal, 'insufficient_data'>, string> = {
  above_average: '↑',
  below_average: '↓',
  stable:        '→',
  fast_rising:   '↑↑',
  trending_up:   '↑',
  trending_down: '↓',
};

export default function TrendBadge({ signal, label, size = 'sm' }: TrendBadgeProps) {
  if (signal === 'insufficient_data') return null;

  const style = STYLES[signal];
  const icon = ICONS[signal];
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-semibold uppercase tracking-wider leading-tight ${textSize} ${style}`}
      title="Based on recent review sentiment vs. overall rating"
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
