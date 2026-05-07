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
}
