'use client';

import { useState, useRef, FormEvent, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchHistory, useLastLocation } from '@/hooks/useSearchHistory';
import { useCompare } from '@/hooks/useCompare';

interface LocationSuggestion {
  label: string;
  placeId: string;
}

interface SearchFormProps {
  defaultLocation?: string;
  defaultCategory?: string;
  variant?: 'hero' | 'compact';
  /** When true, automatically attempt GPS lookup on mount (used for "near me" searches) */
  autoGps?: boolean;
}

export default function SearchForm({
  defaultLocation = '',
  defaultCategory = '',
  variant = 'hero',
  autoGps = false,
}: SearchFormProps) {
  const router = useRouter();
  const lastLocation = useLastLocation();
  const { recents, saveSearch } = useSearchHistory();
  const { clearCompare } = useCompare();

  const [gpsLoading, setGpsLoading]     = useState(false);
  const [gpsError, setGpsError]         = useState('');
  const [submitError, setSubmitError]   = useState('');
  const [locationValue, setLocationValue] = useState(defaultLocation);
  const [suggestions, setSuggestions]   = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex]   = useState(-1);
  const [showRecents, setShowRecents]   = useState(false);
  const [gpsCoords, setGpsCoords]       = useState<{ lat: number; lng: number } | null>(null);

  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const gpsDeniedRef   = useRef(false);
  const categoryRef    = useRef<HTMLInputElement>(null);
  const locationRef    = useRef<HTMLInputElement>(null);

  // Pre-populate location from last search when no default is provided
  useEffect(() => {
    if (!defaultLocation && lastLocation) {
      setLocationValue(lastLocation);
    }
  }, [lastLocation, defaultLocation]);

  // When autoGps=true (e.g. "near me" example searches), attempt GPS on mount.
  // Silent mode — no error shown unless the user later taps the GPS button.
  useEffect(() => {
    if (autoGps) handleGps(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGps]);

  // On mount: silently check if geolocation permission is already denied.
  // If so, mark gpsDeniedRef immediately so the UI shows the location hint
  // without the user having to tap the GPS button first.
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (!('permissions' in navigator)) return;
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
      if (result.state === 'denied') {
        gpsDeniedRef.current = true;
        setGpsError('Location access is off — enter your city, state, or ZIP below.');
      }
    }).catch(() => { /* permissions API not available — ignore */ });
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res  = await fetch(`/api/location-autocomplete?q=${encodeURIComponent(q)}`);
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
    setGpsCoords(null);
    setGpsError('');
    setSubmitError('');
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

  useEffect(() => {
    setSubmitError('');
    setGpsError('');
  }, [defaultCategory]);

  useEffect(() => {
    if (defaultCategory && !defaultLocation) {
      const t = setTimeout(() => {
        if (gpsDeniedRef.current) {
          locationRef.current?.focus();
        } else {
          handleGps(true);
        }
      }, 200);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCategory, defaultLocation]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowSuggestions(false);
    setShowRecents(false);
    const data = new FormData(e.currentTarget);
    const cat  = (data.get('category') as string || '').trim();
    const loc  = locationValue.trim();

    if (!cat) {
      setSubmitError('Please enter a business type to search.');
      return;
    }
    if (!loc || loc === 'Getting your location…') {
      setSubmitError('Please enter a location or use the GPS button.');
      return;
    }
    setSubmitError('');

    // Persist to history
    saveSearch(cat, gpsCoords ? 'Current location' : loc);

    clearCompare();

    if (gpsCoords) {
      router.push(
        `/results?category=${encodeURIComponent(cat)}&lat=${gpsCoords.lat}&lng=${gpsCoords.lng}&location=current+location`
      );
    } else {
      const query = `${cat} in ${loc}`;
      router.push(
        `/results?q=${encodeURIComponent(query)}&location=${encodeURIComponent(loc)}&category=${encodeURIComponent(cat)}`
      );
    }
  };

  const applyRecentSearch = (category: string, location: string) => {
    if (categoryRef.current) categoryRef.current.value = category;
    setLocationValue(location);
    setShowRecents(false);
    setGpsCoords(null);
  };

  const handleGps = async (silent = false) => {
    setGpsError('');
    setGpsLoading(true);
    setLocationValue('Getting your location…');

    try {
      const { Geolocation } = await import('@capacitor/geolocation').catch(() => ({
        Geolocation: null,
      }));

      let latitude: number;
      let longitude: number;

      if (Geolocation) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        latitude  = position.coords.latitude;
        longitude = position.coords.longitude;
      } else if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        latitude  = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else {
        setGpsError('Geolocation is not available on this device.');
        setLocationValue('');
        setGpsLoading(false);
        return;
      }

      setGpsCoords({ lat: latitude, lng: longitude });
      setLocationValue('Current location');
      setGpsLoading(false);
      setGpsError('');
      if (!categoryRef.current?.value) categoryRef.current?.focus();
    } catch (err: unknown) {
      setGpsLoading(false);
      setLocationValue('');
      const code = (err as { code?: number }).code;
      if (code === 1) {
        gpsDeniedRef.current = true;
        if (!silent) setGpsError('Location access is off — enter your city, state, or ZIP below.');
      } else {
        if (!silent) setGpsError('Could not get your location — type your city, state, or ZIP below.');
      }
      locationRef.current?.focus();
    }
  };

  const SpinnerIcon = () => (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );

  const GpsIcon = () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  // Shared recent-searches dropdown
  const RecentsDropdown = ({ wide = false }: { wide?: boolean }) =>
    showRecents && recents.length > 0 ? (
      <div
        className={`absolute z-50 left-0 top-full mt-1 bg-white border border-[#D9CEC8] rounded-xl shadow-lg overflow-hidden ${wide ? 'w-72' : 'w-56'}`}
      >
        <div className="px-3 py-2 border-b border-[#EDE8E3] flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#9A8C85]">Recent searches</span>
          <button
            type="button"
            onClick={() => setShowRecents(false)}
            className="text-[#9A8C85] hover:text-[#5A4A3F] text-xs"
          >
            ✕
          </button>
        </div>
        {recents.map((s, i) => (
          <button
            key={i}
            type="button"
            onMouseDown={() => applyRecentSearch(s.category, s.location)}
            className="w-full text-left px-3 py-2.5 text-sm text-[#241C15] hover:bg-[#FAF7F0] transition-colors flex items-center gap-2"
          >
            <svg className="h-3 w-3 text-[#9A8C85] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">
              <span className="font-medium">{s.category}</span>
              <span className="text-[#7A6B63]"> in {s.location}</span>
            </span>
          </button>
        ))}
      </div>
    ) : null;

  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1">
        <form action="/results" method="GET" onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <input
              ref={categoryRef}
              name="category"
              type="text"
              required
              defaultValue={defaultCategory}
              placeholder="Business type"
              maxLength={100}
              onFocus={() => recents.length > 0 && setShowRecents(true)}
              onBlur={() => setTimeout(() => setShowRecents(false), 150)}
              className="min-w-0 w-28 rounded-lg border border-[#D9CEC8] bg-white px-3 py-2 text-sm text-[#241C15] placeholder-[#7A6B63] focus:border-[#8B5E3C]/50 focus:outline-none focus:ring-1 focus:ring-[#8B5E3C]/20"
            />
            <RecentsDropdown />
          </div>
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
            onClick={() => handleGps()}
            disabled={gpsLoading}
            title="Use my location"
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border border-[#D9CEC8] bg-white text-[#7A6B63] hover:text-[#8B5E3C] hover:border-[#8B5E3C]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {gpsLoading ? <SpinnerIcon /> : <GpsIcon />}
          </button>
          <button
            type="submit"
            disabled={gpsLoading}
            className="min-h-[44px] rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B4A2F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
        </form>
        {submitError && (
          <p className="text-sm text-red-600 mt-1">{submitError}</p>
        )}
        {gpsError && !submitError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>{gpsError}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action="/results" method="GET" onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Category input with recent searches */}
        <div className="flex-1 relative">
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
            onFocus={() => recents.length > 0 && setShowRecents(true)}
            onBlur={() => setTimeout(() => setShowRecents(false), 150)}
            onChange={() => { setSubmitError(''); }}
            className="w-full rounded-xl border border-[#D9CEC8] bg-white px-4 py-3.5 text-[#241C15] placeholder-[#7A6B63] focus:border-[#8B5E3C]/60 focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/15 transition-all shadow-sm"
          />
          <RecentsDropdown wide />
        </div>

        {/* Location input with autocomplete */}
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
      {gpsError && !submitError && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <span className="font-medium">Location access is off.</span>
            {' '}Type your city, state, or ZIP code in the Location field above.
            {gpsDeniedRef.current && (
              <span className="block mt-0.5 text-amber-700 text-xs">
                To enable GPS: go to your browser or phone Settings → Privacy → Location → allow reviewrank.app
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5">
        <p className="text-sm text-[#7A6B63]">
          Enter a city, zip, or address —
        </p>
        <button
          type="button"
          onClick={() => handleGps()}
          disabled={gpsLoading}
          className="text-sm text-[#8B5E3C] hover:text-[#6B4A2F] underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] flex items-center"
        >
          {gpsLoading ? 'Getting location…' : 'use my current location'}
        </button>
      </div>
    </form>
  );
}
