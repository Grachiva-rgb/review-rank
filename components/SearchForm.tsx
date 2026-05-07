'use client';

import { useState, useRef, FormEvent, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface LocationSuggestion {
  label: string;
  placeId: string;
}

interface SearchFormProps {
  defaultLocation?: string;
  defaultCategory?: string;
  variant?: 'hero' | 'compact';
}

export default function SearchForm({
  defaultLocation = '',
  defaultCategory = '',
  variant = 'hero',
}: SearchFormProps) {
  const router = useRouter();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [locationValue, setLocationValue] = useState(defaultLocation);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Refs to read current input values without controlled state
  const categoryRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/location-autocomplete?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleLocationChange = (val: string) => {
    setLocationValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 280);
  };

  const selectSuggestion = (label: string) => {
    setLocationValue(label);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex].label);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // When a suggested search chip pre-fills category with no location, prompt immediately
  useEffect(() => {
    if (defaultCategory && !defaultLocation) {
      setSubmitError('Enter a location or use your current location to search near you.');
      locationRef.current?.focus();
    }
  }, [defaultCategory, defaultLocation]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowSuggestions(false);
    const data = new FormData(e.currentTarget);
    const cat = (data.get('category') as string || '').trim();
    const loc = locationValue.trim();

    if (!cat) {
      setSubmitError('Please enter a business type to search.');
      return;
    }
    if (!loc) {
      setSubmitError('Please enter a location or use your current location.');
      return;
    }
    setSubmitError('');
    const query = `${cat} in ${loc}`;
    router.push(
      `/results?q=${encodeURIComponent(query)}&location=${encodeURIComponent(loc)}&category=${encodeURIComponent(cat)}`
    );
  };

  const handleGps = async () => {
    const cat = (categoryRef.current?.value || '').trim();
    if (!cat) {
      setGpsError('Enter a business type first');
      return;
    }

    setGpsError('');
    setGpsLoading(true);

    try {
      // Prefer Capacitor Geolocation when running as a native app — it is
      // faster, more accurate, and has proper native permission dialogs.
      // Falls back to the standard browser API when running in a web browser.
      const { Geolocation } = await import('@capacitor/geolocation').catch(() => ({
        Geolocation: null,
      }));

      let latitude: number;
      let longitude: number;

      if (Geolocation) {
        // Native Capacitor path
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        latitude  = position.coords.latitude;
        longitude = position.coords.longitude;
      } else if (navigator.geolocation) {
        // Web browser fallback
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        latitude  = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else {
        setGpsError('Geolocation is not available on this device.');
        setGpsLoading(false);
        return;
      }

      setGpsLoading(false);
      setLocationValue('current location');
      router.push(
        `/results?category=${encodeURIComponent(cat)}&lat=${latitude}&lng=${longitude}&location=current+location`
      );
    } catch (err: unknown) {
      setGpsLoading(false);
      const code = (err as { code?: number }).code;
      setGpsError(
        code === 1 // PERMISSION_DENIED
          ? 'Please enter a location to continue.'
          : 'Could not get your location. Please enter it manually.'
      );
    }
  };

  const SpinnerIcon = () => (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );

  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1">
        <form action="/results" method="GET" onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1.5">
          <input
            ref={categoryRef}
            name="category"
            type="text"
            required
            defaultValue={defaultCategory}
            placeholder="Business type"
            maxLength={100}
            className="min-w-0 w-28 rounded-lg border border-[#D9CEC8] bg-white px-3 py-2 text-sm text-[#241C15] placeholder-[#7A6B63] focus:border-[#8B5E3C]/50 focus:outline-none focus:ring-1 focus:ring-[#8B5E3C]/20"
          />
          <span className="text-[#7A6B63] text-sm">in</span>
          <div className="relative">
            <input
              ref={locationRef}
              name="location"
              type="text"
              value={locationValue}
              onChange={e => handleLocationChange(e.target.value)}
              onKeyDown={handleLocationKeyDown}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="City or zip"
              maxLength={100}
              autoComplete="off"
              suppressHydrationWarning
              className="min-w-0 w-24 rounded-lg border border-[#D9CEC8] bg-white px-3 py-2 text-sm text-[#241C15] placeholder-[#7A6B63] focus:border-[#8B5E3C]/50 focus:outline-none focus:ring-1 focus:ring-[#8B5E3C]/20"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 left-0 top-full mt-1 w-56 bg-white border border-[#D9CEC8] rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={s.placeId}
                    type="button"
                    onMouseDown={() => selectSuggestion(s.label)}
                    className={`w-full text-left px-3 py-2 text-sm text-[#241C15] hover:bg-[#FAF7F0] transition-colors ${i === activeIndex ? 'bg-[#FAF7F0]' : ''}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleGps}
            disabled={gpsLoading}
            title="Use my location"
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border border-[#D9CEC8] bg-white text-[#7A6B63] hover:text-[#8B5E3C] hover:border-[#8B5E3C]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {gpsLoading ? <SpinnerIcon /> : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          <button
            type="submit"
            disabled={gpsLoading}
            className="min-h-[44px] rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B4A2F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
        </form>
        {(submitError || gpsError) && (
          <p className="text-sm text-red-600">{submitError || gpsError}</p>
        )}
      </div>
    );
  }

  return (
    <form action="/results" method="GET" onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-xs text-[#7A6B63] mb-1.5 uppercase tracking-widest font-mono">
            Business Type
          </label>
          <input
            ref={categoryRef}
            name="category"
            type="text"
            required
            defaultValue={defaultCategory}
            placeholder="mechanic, dentist, plumber, HVAC..."
            maxLength={100}
            autoComplete="off"
            className="w-full rounded-xl border border-[#D9CEC8] bg-white px-4 py-3.5 text-[#241C15] placeholder-[#7A6B63] focus:border-[#8B5E3C]/60 focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/15 transition-all shadow-sm"
          />
        </div>

        <div className="sm:w-52 relative">
          <label className="block text-xs text-[#7A6B63] mb-1.5 uppercase tracking-widest font-mono">
            Location
          </label>
          <input
            ref={locationRef}
            name="location"
            type="text"
            value={locationValue}
            onChange={e => handleLocationChange(e.target.value)}
            onKeyDown={handleLocationKeyDown}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="City or zip code"
            maxLength={100}
            autoComplete="off"
            suppressHydrationWarning
            className="w-full rounded-xl border border-[#D9CEC8] bg-white px-4 py-3.5 text-[#241C15] placeholder-[#7A6B63] focus:border-[#8B5E3C]/60 focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/15 transition-all shadow-sm"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[#D9CEC8] rounded-xl shadow-lg overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <button
                  key={s.placeId}
                  type="button"
                  onMouseDown={() => selectSuggestion(s.label)}
                  className={`w-full text-left px-4 py-2.5 text-sm text-[#241C15] hover:bg-[#FAF7F0] transition-colors ${i === activeIndex ? 'bg-[#FAF7F0]' : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sm:self-end">
          <button
            type="submit"
            disabled={gpsLoading}
            className="w-full sm:w-auto rounded-xl bg-[#8B5E3C] px-8 py-3.5 font-bold text-white hover:bg-[#6B4A2F] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
          >
            Find trusted businesses →
          </button>
        </div>
      </div>

      {submitError && (
        <p className="text-sm text-red-600 mt-2">{submitError}</p>
      )}

      <div className="flex items-center gap-2 mt-2.5">
        <p className="text-sm text-[#7A6B63]">
          Enter a city, zip, or address —
        </p>
        <button
          type="button"
          onClick={handleGps}
          disabled={gpsLoading}
          className="text-sm text-[#8B5E3C] hover:text-[#6B4A2F] underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] flex items-center"
        >
          {gpsLoading ? 'Getting location…' : 'use my current location'}
        </button>
      </div>

      {gpsError && (
        <p className="text-sm text-red-600 mt-1">{gpsError}</p>
      )}
    </form>
  );
}
