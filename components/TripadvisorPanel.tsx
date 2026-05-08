'use client';

import type { MultiSourceScore, TripadvisorBusinessData } from '@/lib/types';
import { confidenceLevelLabel, confidenceLevelColor } from '@/lib/multiSourceScoring';

interface Props {
  ta: TripadvisorBusinessData;
  multiScore: MultiSourceScore;
}

function StarRow({ label, value }: { label: string; value?: number }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#7A6B63]">{label}</span>
      <span className="font-mono text-[#241C15]">{value.toFixed(1)}</span>
    </div>
  );
}

export default function TripadvisorPanel({ ta, multiScore }: Props) {
  const confidenceColor = confidenceLevelColor(multiScore.confidence);
  const confidenceLabel = confidenceLevelLabel(multiScore.confidence);
  const hasSubratings = ta.subratings && Object.keys(ta.subratings).length > 0;
  const hasAwards = ta.awards && ta.awards.length > 0;

  return (
    <div className="rounded-2xl border border-[#EDE8E3] bg-white p-5 mb-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="text-xs text-[#7A6B63] uppercase tracking-widest font-mono">
              Tripadvisor Signal
            </div>
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${confidenceColor}`}>
              {confidenceLabel}
            </span>
          </div>
          <p className="text-xs text-[#9A8C85] leading-relaxed">{multiScore.confidenceReason}</p>
        </div>
        {/* TA rating bubble */}
        <div className="flex-shrink-0 text-center">
          <div className="w-12 h-12 rounded-xl border-2 border-[#00AA6C]/30 bg-[#00AA6C]/5 flex items-center justify-center">
            <span className="font-mono text-base font-bold text-[#00AA6C]">{ta.rating.toFixed(1)}</span>
          </div>
          <div className="text-[10px] text-[#7A6B63] mt-1 font-mono">{ta.reviewCount.toLocaleString()} reviews</div>
        </div>
      </div>

      {/* Traveler ranking */}
      {ta.travelerRanking && (
        <div className="text-xs text-[#5A4A3F] bg-[#FAF7F0] rounded-lg px-3 py-2 mb-3 font-medium">
          {ta.travelerRanking}
        </div>
      )}

      {/* Awards */}
      {hasAwards && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ta.awards!.map((award, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700"
            >
              ★ {award}
            </span>
          ))}
        </div>
      )}

      {/* Sub-ratings grid */}
      {hasSubratings && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3 border-t border-[#EDE8E3] pt-3">
          <StarRow label="Food"          value={ta.subratings?.food} />
          <StarRow label="Service"       value={ta.subratings?.service} />
          <StarRow label="Value"         value={ta.subratings?.value} />
          <StarRow label="Ambiance"      value={ta.subratings?.ambiance} />
          <StarRow label="Cleanliness"   value={ta.subratings?.cleanliness} />
          <StarRow label="Rooms"         value={ta.subratings?.rooms} />
          <StarRow label="Location"      value={ta.subratings?.location} />
          <StarRow label="Sleep Quality" value={ta.subratings?.sleepQuality} />
        </div>
      )}

      {/* Platform consistency bar */}
      <div className="border-t border-[#EDE8E3] pt-3">
        <div className="flex justify-between text-xs text-[#7A6B63] mb-1.5">
          <span>Platform consistency</span>
          <span className="font-semibold text-[#241C15]">{multiScore.platformConsistency}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#EDE8E3] overflow-hidden">
          <div
            className={`h-full rounded-full ${
              multiScore.platformConsistency >= 80 ? 'bg-[#2F6F4E]' :
              multiScore.platformConsistency >= 60 ? 'bg-[#8B5E3C]' : 'bg-amber-500'
            }`}
            style={{ width: `${multiScore.platformConsistency}%` }}
          />
        </div>
        <p className="text-[10px] text-[#9A8C85] mt-2">
          How closely Google and Tripadvisor ratings align. Higher = stronger cross-platform trust signal.
        </p>
      </div>

      {/* Trust disclosure */}
      <p className="text-[10px] text-[#B8A89F] mt-3 border-t border-[#EDE8E3] pt-2.5 leading-relaxed">
        Tripadvisor is one of multiple reputation signals used by Review Rank. Scores are not reproduced from Tripadvisor's ranking algorithm. No paid placements.
      </p>
    </div>
  );
}
