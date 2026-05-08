import type { TrendSignal } from './reviewRankScoring';
export type { TrendSignal };

// ─── Tripadvisor / multi-source types ────────────────────────────────────────

export interface TripadvisorBusinessData {
  taLocationId: string;
  rating: number;
  reviewCount: number;
  category: string;
  travelerRanking?: string;   // e.g. "#4 of 3,102 Restaurants in Cleveland"
  priceLevel?: string;        // '$' | '$$ - $$$' | '$$$$'
  awards?: string[];          // ["Travelers' Choice 2025"]
  subratings?: {
    food?: number;
    service?: number;
    value?: number;
    ambiance?: number;
    cleanliness?: number;
    rooms?: number;
    location?: number;
    sleepQuality?: number;
  };
  lastFetched?: string;       // ISO date
}

export type ReviewSourceName = 'google' | 'tripadvisor';

export interface ReviewSource {
  source: ReviewSourceName;
  rating: number;
  reviewCount: number;
  confidenceWeight: number;   // 0.0–1.0
  lastFetched?: string;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'single_source';

export interface MultiSourceScore {
  finalScore: number;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  platformConsistency: number;    // 0–100
  sources: ReviewSource[];
  isHospitalityCategory: boolean;
  travelersChoiceAward: boolean;
}

export interface Place {
  place_id: string;
  name: string;
  rating: number;
  user_ratings_total: number;
  formatted_address: string;
  vicinity?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  opening_hours?: {
    open_now?: boolean;
  };
  price_level?: number;
  url?: string;
  smart_score: number;
  /** Predictive Reputation Score, 0–100, from reviewRankScoring.ts */
  review_rank_score: number;
  /** Plain-English reasons driving the score; safe to render directly. */
  score_explanations: string[];
  /** Rank tier label: Elite | Highly Trusted | Trusted | Established | Limited Reputation */
  rank_label: string;
  /** Individual 0–100 sub-scores from the scoring model. */
  score_components?: {
    bayesian: number;
    volume: number;
    sentiment: number;
    consistency: number;
  };
  /** Proxy trend derived from recent-review sentiment vs bayesian rating. */
  trend_signal?: TrendSignal;
  /** Human-readable label for trend_signal. */
  trend_label?: string;
  /** Tripadvisor data when available from the background cache. */
  ta_data?: TripadvisorBusinessData;
  /** Multi-source score blending Google + Tripadvisor when ta_data is present. */
  multi_source_score?: MultiSourceScore;
}

export interface PlaceDetail {
  place_id: string;
  name: string;
  rating: number;
  user_ratings_total: number;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  price_level?: number;
  formatted_phone_number?: string;
  website?: string;
  url?: string;
  reviews?: Array<{
    author_name: string;
    author_url?: string;
    profile_photo_url?: string;
    rating: number;
    relative_time_description: string;
    text: string;
  }>;
  smart_score: number;
  review_rank_score: number;
  score_explanations: string[];
  rank_label: string;
  score_components?: {
    bayesian: number;
    volume: number;
    sentiment: number;
    consistency: number;
  };
  trend_signal?: TrendSignal;
  trend_label?: string;
  ta_data?: TripadvisorBusinessData;
  multi_source_score?: MultiSourceScore;
}

export type SortFilter = 'smart_score' | 'rating' | 'reviews' | 'rising_stars';

export interface NormalizedBusiness {
  place_id: string;
  name: string;
  rating: number;
  review_count: number;
  address: string;
  maps_url: string;
  smart_score: number;
  review_rank_score: number;
  rank_label: string;
  score_explanations: string[];
}
