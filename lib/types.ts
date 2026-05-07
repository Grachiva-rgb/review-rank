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
