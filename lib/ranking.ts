/**
 * Smart Score = max(0, rating − 3.5) × log₁₀(total_reviews + 1)
 *
 * Baseline of 3.5 reflects consumer reality: 4.5★+ is genuinely good,
 * 4.0–4.4★ is acceptable, below 3.5★ should score 0.
 * Results are also hard-filtered to 4.0★ minimum before display.
 *
 * Examples:
 *   4.9★ · 500 reviews:   1.4 × 2.7 = 3.78  (Trusted)
 *   4.7★ · 6k reviews:    1.2 × 3.78 = 4.54  (Highly Trusted)
 *   4.0★ · 50k reviews:   0.5 × 4.70 = 2.35  (Established — correctly low)
 *   3.9★ · any reviews:   filtered out entirely
 *
 * Max theoretical score ≈ 7.5 (5★ × millions of reviews → 1.5 × 5.0)
 */
export function calculateSmartScore(rating: number, totalReviews: number): number {
  if (!rating || rating <= 0) return 0;
  const adjusted = Math.max(0, rating - 3.5);
  const score = adjusted * Math.log10((totalReviews || 0) + 1);
  return parseFloat(score.toFixed(2));
}

/** Minimum rating to show in results — below this, a business is not surfaced. */
export const MIN_DISPLAY_RATING = 4.0;

export function getScoreColor(score: number): string {
  if (score >= 4) return 'text-emerald-700';
  if (score >= 2.5) return 'text-amber-700';
  if (score >= 1.2) return 'text-orange-700';
  return 'text-red-700';
}

export function getScoreBgColor(score: number): string {
  if (score >= 4) return 'bg-emerald-50 border-emerald-200';
  if (score >= 2.5) return 'bg-amber-50 border-amber-200';
  if (score >= 1.2) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

export function getScoreLabel(score: number): string {
  if (score >= 4.5) return 'Highly Trusted';
  if (score >= 3) return 'Well Trusted';
  if (score >= 1.8) return 'Trusted';
  if (score >= 1) return 'Established';
  return 'Limited Data';
}

// ─── Trust Tier ─────────────────────────────────────────────────────────────
// Modelled after tiered trust systems used by Angi (Top Pro), Healthgrades
// (Most Recommended), and Consumer Reports (Recommended) — clear, earned tiers.

export type TrustTier = 'highly_trusted' | 'trusted' | 'established' | null;

/**
 * Tier from the 0–100 Review Rank Score. This is the preferred entry point —
 * the score already blends rating, volume, sentiment, and consistency.
 */
export function getTrustTierFromRRS(
  reviewRankScore: number,
  rating: number,
  reviewCount: number
): TrustTier {
  // Highly Trusted: top tier — strong blended score AND high rating AND real volume
  if (reviewRankScore >= 65 && rating >= 4.5 && reviewCount >= 150) return 'highly_trusted';
  // Trusted: reliably solid — blended score above the "Trusted" threshold
  if (reviewRankScore >= 50 && rating >= 4.2) return 'trusted';
  // Established: meaningful track record at acceptable quality
  if (reviewRankScore >= 35 && rating >= 4.0 && reviewCount >= 50) return 'established';
  return null;
}

/**
 * Legacy tier from the old Smart Score (0–7.5 scale). Retained for callers
 * that still pass smart_score; prefer getTrustTierFromRRS for new code.
 */
export function getTrustTier(
  score: number,
  rating: number,
  reviewCount: number
): TrustTier {
  // Highly Trusted: 4.5★+ with strong volume (≈ 4.5★ × 150+ reviews)
  if (score >= 4.5 && rating >= 4.5 && reviewCount >= 150) return 'highly_trusted';
  // Trusted: solid — 4.2★+ with at least some track record
  if (score >= 2.5 && rating >= 4.2) return 'trusted';
  // Established: 4.0★+ with enough reviews to be meaningful
  if (reviewCount >= 50 && rating >= 4.0) return 'established';
  return null;
}

export function getTrustTierLabel(tier: TrustTier): string {
  if (tier === 'highly_trusted') return 'Highly Trusted';
  if (tier === 'trusted') return 'Trusted';
  if (tier === 'established') return 'Established';
  return '';
}

export function getTrustTierStyle(tier: TrustTier): string {
  if (tier === 'highly_trusted')
    return 'text-[#2F6F4E] bg-[#2F6F4E]/10 border-[#2F6F4E]/25';
  if (tier === 'trusted')
    return 'text-[#5A4A3F] bg-[#5A4A3F]/10 border-[#5A4A3F]/20';
  if (tier === 'established')
    return 'text-[#7A6B63] bg-[#7A6B63]/10 border-[#7A6B63]/20';
  return '';
}

// ─── Category Detection ──────────────────────────────────────────────────────
// Detects service category from search query so trust summaries and insights
// use domain-appropriate language (e.g. "patients" for dentists, "homeowners"
// for roofers) — similar to Angi's category-specific trust language.

export type BusinessCategory =
  | 'automotive'
  | 'plumbing'
  | 'hvac'
  | 'electrical'
  | 'medical'
  | 'legal'
  | 'roofing'
  | 'home_services'
  | 'wellness'
  | 'food'
  | 'hospitality'
  | 'general';

export function detectCategory(query: string): BusinessCategory {
  const q = query.toLowerCase();
  if (/mechanic|auto repair|car repair|tire|oil change|brake|transmission|body shop/.test(q))
    return 'automotive';
  if (/plumber|plumbing|drain|pipe|water heater|leak|sewer/.test(q))
    return 'plumbing';
  if (/hvac|heating|cooling|air condition|furnace|heat pump|duct/.test(q))
    return 'hvac';
  if (/electrician|electrical|wiring|outlet|circuit|panel/.test(q))
    return 'electrical';
  if (/dentist|doctor|medical|clinic|therapy|physician|healthcare|vet|chiropractic|optometrist/.test(q))
    return 'medical';
  if (/lawyer|attorney|legal|law firm|paralegal/.test(q))
    return 'legal';
  if (/roof|roofer|roofing|gutter/.test(q))
    return 'roofing';
  if (/contractor|handyman|landscap|clean|pest|paint|floor|remodel|renovation/.test(q))
    return 'home_services';
  if (/salon|spa|barber|nail|massage|hair|beauty|wax/.test(q))
    return 'wellness';
  if (/restaurant|cafe|coffee|pizza|sushi|taco|burger|food|diner|bistro|bakery|ramen|bbq|steakhouse/.test(q))
    return 'food';
  if (/hotel|motel|resort|inn|suites|lodge|accommodation|bed and breakfast|b&b|airbnb|hostel|attraction|museum|park|theme park|zoo|aquarium|tour|tourism/.test(q))
    return 'hospitality';
  return 'general';
}

// ─── Trust Summary ───────────────────────────────────────────────────────────
// Short plain-English trust sentence for business cards.
// Category-specific language based on what customers value in each service type.

const CATEGORY_TERMS: Record<
  BusinessCategory,
  { group: string; value: string }
> = {
  automotive: { group: 'customers', value: 'honest work and fair pricing' },
  plumbing:   { group: 'homeowners', value: 'reliable service and clear pricing' },
  hvac:       { group: 'homeowners', value: 'quality installs and responsive service' },
  electrical: { group: 'customers', value: 'safe, licensed, reliable work' },
  medical:    { group: 'patients', value: 'attentive care and professionalism' },
  legal:      { group: 'clients', value: 'clear communication and professional counsel' },
  roofing:    { group: 'homeowners', value: 'quality workmanship and follow-through' },
  home_services: { group: 'homeowners', value: 'reliable work and fair pricing' },
  wellness:   { group: 'clients', value: 'consistent quality and friendly service' },
  food:        { group: 'customers', value: 'consistent quality and experience' },
  hospitality: { group: 'travelers', value: 'exceptional stays and memorable experiences' },
  general:     { group: 'customers', value: 'consistent service quality' },
};

export function getTrustSummary(
  rating: number,
  reviewCount: number,
  category: BusinessCategory = 'general'
): string {
  const terms = CATEGORY_TERMS[category];
  const hi = rating >= 4.5;
  const ok = rating >= 4.2;
  const highVol = reviewCount >= 500;
  const midVol = reviewCount >= 100;

  if (hi && highVol)
    return `Consistently praised for ${terms.value} across ${reviewCount.toLocaleString()} ${terms.group}.`;
  if (hi && midVol)
    return `Highly regarded for ${terms.value} by ${reviewCount.toLocaleString()} ${terms.group}.`;
  if (hi)
    return `Strong early signals — ${rating.toFixed(1)}★ from ${reviewCount} ${terms.group}.`;
  if (ok && highVol)
    return `Well-established with ${reviewCount.toLocaleString()} ${terms.group} and a solid track record.`;
  if (ok && midVol)
    return `Solid reputation built across ${reviewCount.toLocaleString()} ${terms.group}.`;
  if (midVol)
    return `${reviewCount.toLocaleString()} ${terms.group} have reviewed this business (${rating.toFixed(1)}★).`;
  return `Only ${reviewCount} reviews at ${rating.toFixed(1)}★ — not enough history to assess reliability with confidence.`;
}

// ─── Card Ranking Explanation ────────────────────────────────────────────────
// One-line explanation shown on business cards describing *why* the business
// ranks well in its category — surfaces category-specific trust signals.

const RANKING_EXPLANATION: Record<
  BusinessCategory,
  { strong: string; solid: string; early: string }
> = {
  automotive: {
    strong: 'Ranks highly for honest pricing and reliable repairs based on public review signals.',
    solid:  'Strong review history with positive signals around fair pricing and quality work.',
    early:  'Building a reputation — early reviews suggest honest service and reliable repairs.',
  },
  plumbing: {
    strong: 'Ranks highly for prompt response and transparent pricing based on public review signals.',
    solid:  'Strong review history with positive signals around reliable service and clear quotes.',
    early:  'Building a reputation — early reviews suggest reliable service and fair pricing.',
  },
  hvac: {
    strong: 'Ranks highly for quality installs and responsive service based on public review signals.',
    solid:  'Strong review history with positive signals around professional service and clear pricing.',
    early:  'Building a reputation — early reviews suggest thorough diagnostics and professional work.',
  },
  electrical: {
    strong: 'Ranks highly for safe, licensed work and code compliance based on public review signals.',
    solid:  'Strong review history with positive signals around safety and clear communication.',
    early:  'Building a reputation — early reviews suggest professional and safety-focused service.',
  },
  medical: {
    strong: 'Ranks highly for patient care and professionalism based on public review signals.',
    solid:  'Strong review history with positive signals around attentive care and communication.',
    early:  'Building a reputation — early reviews suggest attentive care and a welcoming environment.',
  },
  legal: {
    strong: 'Ranks highly for professional counsel and clear communication based on public review signals.',
    solid:  'Strong review history with positive signals around responsiveness and client outcomes.',
    early:  'Building a reputation — early reviews suggest responsive service and clear guidance.',
  },
  roofing: {
    strong: 'Ranks highly for quality workmanship and follow-through based on public review signals.',
    solid:  'Strong review history with positive signals around professional crews and clean results.',
    early:  'Building a reputation — early reviews suggest quality materials and professional installs.',
  },
  home_services: {
    strong: 'Ranks highly for reliable work and fair pricing based on public review signals.',
    solid:  'Strong review history with positive signals around professionalism and consistent results.',
    early:  'Building a reputation — early reviews suggest reliable service and fair pricing.',
  },
  wellness: {
    strong: 'Ranks highly for consistent quality and skilled practitioners based on public review signals.',
    solid:  'Strong review history with positive signals around friendly service and consistent results.',
    early:  'Building a reputation — early reviews suggest welcoming service and quality work.',
  },
  food: {
    strong: 'Ranks highly for food quality and consistent dining experience based on public review signals.',
    solid:  'Strong review history with positive signals around food quality and attentive service.',
    early:  'Building a reputation — early reviews suggest quality food and a welcoming atmosphere.',
  },
  hospitality: {
    strong: 'Ranks highly for exceptional guest experience and traveler satisfaction based on public review signals.',
    solid:  'Strong review history with positive signals around quality accommodations and attentive service.',
    early:  'Building a reputation — early traveler reviews suggest a welcoming experience worth considering.',
  },
  general: {
    strong: 'Ranks highly for consistent service quality based on public review signals.',
    solid:  'Strong review history with positive signals around reliability and professional service.',
    early:  'Building a reputation — early reviews suggest consistent and professional service.',
  },
};

export function getRankingExplanation(
  rating: number,
  reviewCount: number,
  category: BusinessCategory = 'general'
): string {
  const hi = rating >= 4.5;
  const ok = rating >= 4.2;
  const midVol = reviewCount >= 50;
  const exp = RANKING_EXPLANATION[category];
  if (hi && midVol) return exp.strong;
  if (ok && midVol) return exp.solid;
  return exp.early;
}

// ─── Category-Aware Detail Insights ─────────────────────────────────────────
// Replaces the generic "What people love / Watch-outs / Best for" on the
// business detail page with category-specific, trust-oriented language.

export interface BusinessInsights {
  trustSummary: string;
  whatCustomersPraise: string;
  commonConsiderations: string;
  reliabilitySignal: string;
  bestFor: string;
}

export function getBusinessInsights(
  rating: number,
  reviewCount: number,
  category: BusinessCategory
): BusinessInsights {
  const hi = rating >= 4.5;
  const ok = rating >= 4.2;
  const highVol = reviewCount >= 500;
  const midVol = reviewCount >= 100;

  const tier = getTrustTier(
    calculateSmartScore(rating, reviewCount),
    rating,
    reviewCount
  );

  const trustSummary =
    tier === 'highly_trusted'
      ? `This business has earned a Highly Trusted designation — ${rating.toFixed(1)}★ across ${reviewCount.toLocaleString()} reviews signals an exceptional and consistent track record.`
      : tier === 'trusted'
      ? `This business is Trusted — customers consistently rate it ${rating.toFixed(1)}★ across ${reviewCount.toLocaleString()} reviews, indicating reliable, quality service.`
      : tier === 'established'
      ? `This business is Established — a decent presence with ${reviewCount.toLocaleString()} reviews and a ${rating.toFixed(1)}★ rating, though not yet among the top-ranked providers in this area.`
      : `Limited review history — only ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'} at ${rating.toFixed(1)}★. Not enough data to assess reliability with confidence.`;

  const insights: Record<
    BusinessCategory,
    { praise: [string, string, string]; considerations: [string, string, string]; bestFor: [string, string, string] }
  > = {
    automotive: {
      praise: [
        'Customers frequently cite honest diagnostics, fair pricing, and work completed on time.',
        'Reviewers highlight transparent estimates and mechanics who explain issues clearly.',
        'Early reviewers note attentive service and accurate repair timelines.',
      ],
      considerations: [
        'Some customers mention waits during peak hours — calling ahead is recommended.',
        'A small number of reviews note communication delays for complex repairs.',
        'Limited review history — verify current service quality with recent reviews.',
      ],
      bestFor: [
        'Anyone who values honest pricing and clear communication from a mechanic.',
        'Drivers looking for a reliable shop with a solid track record.',
        'Those seeking a local alternative to dealership service.',
      ],
    },
    plumbing: {
      praise: [
        'Customers consistently cite prompt response times and transparent pricing before work begins.',
        'Reviewers appreciate punctual arrivals and clean, professional work.',
        'Early customers highlight reliable diagnosis and fair estimates.',
      ],
      considerations: [
        'Emergency availability may vary — confirm availability before a crisis arises.',
        'Some customers note higher pricing for after-hours calls.',
        'Limited history — check recent reviews for current responsiveness.',
      ],
      bestFor: [
        'Homeowners who need a reliable plumber with upfront pricing.',
        'Anyone dealing with urgent plumbing issues and needing fast response.',
        'Those seeking a local plumber with a proven track record.',
      ],
    },
    hvac: {
      praise: [
        'Customers frequently praise quality installations, energy-efficient recommendations, and responsive follow-up.',
        'Reviewers highlight professional technicians who explain system options clearly.',
        'Early reviews note thorough diagnostics and fair service quotes.',
      ],
      considerations: [
        'Scheduling during peak season (summer/winter) can take time — book ahead.',
        'Some customers mention longer wait times for parts on certain systems.',
        'Limited history — confirm current availability and scheduling lead times.',
      ],
      bestFor: [
        'Homeowners looking for a trusted HVAC provider for installs or repairs.',
        'Anyone needing seasonal maintenance with a reliable, certified team.',
        'Those who want transparent pricing and professional consultation.',
      ],
    },
    electrical: {
      praise: [
        'Customers consistently cite licensed, safe work with clear pricing and code compliance.',
        'Reviewers appreciate electricians who explain the work and provide clear timelines.',
        'Early reviews highlight safety-conscious work and professional conduct.',
      ],
      considerations: [
        'Complex or large-scale jobs may require scheduling well in advance.',
        'Some customers note pricing variation for complex panel or wiring work.',
        'Limited history — verify licensing and insurance before engagement.',
      ],
      bestFor: [
        'Homeowners needing licensed electrical work done safely and to code.',
        'Anyone upgrading panels, adding circuits, or handling EV charger installs.',
        'Those prioritizing safety and clear communication on electrical projects.',
      ],
    },
    medical: {
      praise: [
        'Patients frequently cite attentive care, clear communication, and a welcoming, professional environment.',
        'Reviewers highlight knowledgeable practitioners who take time to explain treatment plans.',
        'Early patients note gentle, thorough care and friendly staff.',
      ],
      considerations: [
        'Wait times can increase during busy periods — scheduling ahead is recommended.',
        'Some patients mention insurance verification taking extra time.',
        'Limited history — check recent reviews for current patient experience.',
      ],
      bestFor: [
        'Patients seeking attentive, professional care with good communication.',
        'Anyone looking for a provider with a consistent track record of positive outcomes.',
        'Those who value a welcoming, low-stress environment for appointments.',
      ],
    },
    legal: {
      praise: [
        'Clients consistently cite professional communication, timely responses, and clear counsel.',
        'Reviewers appreciate attorneys who explain legal options in plain language.',
        'Early clients note a responsive team and transparent billing.',
      ],
      considerations: [
        'Complex cases may involve longer timelines — set realistic expectations early.',
        'Some clients note initial consultations can be brief due to scheduling.',
        'Limited history — request references and review credentials before engagement.',
      ],
      bestFor: [
        'Clients who need professional legal counsel with clear, direct communication.',
        'Anyone seeking representation with a history of positive client outcomes.',
        'Those who value transparency in billing and case management.',
      ],
    },
    roofing: {
      praise: [
        'Customers frequently cite quality materials, workmanlike installation, and thorough cleanup.',
        'Reviewers highlight crews that arrive on time and communicate project progress.',
        'Early customers note professional inspections and fair, itemized quotes.',
      ],
      considerations: [
        'Peak storm season can affect scheduling — plan major projects in advance.',
        'Some customers mention insurance coordination taking additional time.',
        'Limited history — request references from recent projects before signing.',
      ],
      bestFor: [
        'Homeowners needing a reliable roofer with a clean track record of completed projects.',
        'Anyone dealing with storm damage or long-overdue roof replacement.',
        'Those seeking clear communication and quality workmanship on a major investment.',
      ],
    },
    home_services: {
      praise: [
        'Customers consistently cite reliable scheduling, quality work, and transparent pricing.',
        'Reviewers appreciate professionals who show up on time and leave the work area clean.',
        'Early reviews note thorough consultations and fair, detailed estimates.',
      ],
      considerations: [
        'Booking during busy seasons may require extra lead time.',
        'Some customers note pricing varies for complex or large-scale projects.',
        'Limited history — request a detailed quote and check insurance before work begins.',
      ],
      bestFor: [
        'Homeowners who need reliable service work with professional standards.',
        'Anyone looking to avoid the risk of unreliable contractors.',
        'Those who value clear communication and fair pricing on home projects.',
      ],
    },
    wellness: {
      praise: [
        'Clients consistently cite skilled practitioners, welcoming environments, and consistent results.',
        'Reviewers highlight friendly staff, attention to detail, and a relaxing experience.',
        'Early clients note clean facilities and professionals who listen to preferences.',
      ],
      considerations: [
        'Popular appointment slots can fill quickly — advance booking is recommended.',
        'Some clients note pricing may be higher than budget alternatives.',
        'Limited history — try a single session before committing to packages.',
      ],
      bestFor: [
        'Anyone seeking a consistent, high-quality wellness or beauty experience.',
        'Clients who value skilled practitioners in a professional, welcoming setting.',
        'Those looking for a trusted local option with a strong word-of-mouth reputation.',
      ],
    },
    food: {
      praise: [
        'Customers consistently praise quality food, attentive service, and a welcoming experience.',
        'Reviewers highlight consistency across visits and a menu that delivers on expectations.',
        'Early visitors note fresh ingredients and friendly staff.',
      ],
      considerations: [
        'Popular spots can have longer waits during peak dining hours.',
        'Some customers note parking or seating availability during busy periods.',
        'Limited history — early reviews may not reflect fully settled operations.',
      ],
      bestFor: [
        'Anyone looking for a reliable dining experience with consistent quality.',
        'Diners who want to avoid disappointing meals by choosing proven local spots.',
        'Those seeking a well-reviewed option for a meal worth the trip.',
      ],
    },
    hospitality: {
      praise: [
        'Travelers consistently praise the quality of accommodations, attentive staff, and memorable experiences.',
        'Guests highlight comfortable surroundings, helpful service, and value for the stay.',
        'Early visitors note a welcoming atmosphere and attention to detail.',
      ],
      considerations: [
        'Peak seasons and special events can affect availability and pricing — booking early is recommended.',
        'Some travelers note variability in room quality or service during high-demand periods.',
        'Limited review history — early feedback may not reflect settled operations.',
      ],
      bestFor: [
        'Travelers seeking a trusted accommodation or experience backed by consistent guest reviews.',
        'Those who want to make confident booking decisions using verified traveler signals.',
        'Anyone planning a trip who values reputation intelligence over advertising.',
      ],
    },
    general: {
      praise: [
        'Customers consistently cite quality service, professional conduct, and reliable results.',
        'Reviewers appreciate responsive communication and work delivered as promised.',
        'Early reviews reflect a team building a positive reputation.',
      ],
      considerations: [
        'Scheduling availability may vary — confirming in advance is always recommended.',
        'Some customers note response times during peak periods.',
        'Limited history — check recent reviews for the most current experience.',
      ],
      bestFor: [
        'Anyone seeking a reliable local business with a proven track record.',
        'Those who value consistent quality and professional service.',
        'Customers who want confidence before choosing a local provider.',
      ],
    },
  };

  // 0 = high praise (hi rating + strong volume), 1 = solid (ok), 2 = cautious/early
  const idx = hi && highVol ? 0 : hi && midVol ? 0 : hi ? 2 : ok ? 1 : 2;
  const cat = insights[category];

  return {
    trustSummary,
    whatCustomersPraise: cat.praise[Math.min(idx, 2)],
    commonConsiderations: cat.considerations[Math.min(idx, 2)],
    reliabilitySignal:
      hi && highVol
        ? `Strong long-term review history with ${reviewCount.toLocaleString()} reviews and a ${rating.toFixed(1)}★ average signals reliable, consistent service.`
        : hi
        ? `A ${rating.toFixed(1)}★ rating from ${reviewCount.toLocaleString()} reviews indicates strong quality — continued review growth will further confirm reliability.`
        : ok && highVol
        ? `Well-established with ${reviewCount.toLocaleString()} reviews. A ${rating.toFixed(1)}★ average reflects broad customer experience.`
        : `${reviewCount.toLocaleString()} reviews at ${rating.toFixed(1)}★. Check recent reviews to assess current quality.`,
    bestFor: cat.bestFor[Math.min(idx, 2)],
  };
}
