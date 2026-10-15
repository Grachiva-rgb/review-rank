'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { BusinessCategory } from '@/lib/ranking';
import { businessCategoryToPartnerCategory } from '@/lib/categories';

// ─── Module-level coverage cache ─────────────────────────────────────────────
// Exact business identity avoids reusing coverage across radius boundaries.
// This is a hint only: submission always verifies/matches again server-side.
const coverageCache = new Map<string, { expiresAt: number; promise: Promise<boolean> }>();

async function fetchCoverage(category: string, businessId: string): Promise<boolean> {
  const params = new URLSearchParams({ category, business_place_id: businessId });
  try {
    const res = await fetch(`/api/partner-coverage?${params.toString()}`);
    if (!res.ok) return false;
    const data = await res.json() as { hasPartner?: boolean };
    return data.hasPartner === true;
  } catch {
    return false;
  }
}

// Categories eligible for lead generation
const LEAD_ELIGIBLE: Set<BusinessCategory> = new Set([
  'plumbing',
  'hvac',
  'electrical',
  'roofing',
  'legal',
  'automotive',
  'home_services',
  'medical',
]);

const CATEGORY_CTA: Partial<Record<BusinessCategory, string>> = {
  plumbing:      'Request a Plumber',
  hvac:          'Request HVAC Service',
  electrical:    'Request an Electrician',
  roofing:       'Request a Roofing Quote',
  legal:         'Request a Consultation',
  automotive:    'Request a Mechanic',
  home_services: 'Request a Quote',
  medical:       'Request an Appointment',
};

interface QuoteButtonProps {
  businessName: string;
  businessId: string;
  businessAddress?: string;
  category: BusinessCategory;
}

export default function QuoteButton({ businessName, businessId, businessAddress, category }: QuoteButtonProps) {
  const id = useId();
  const [isOpen, setIsOpen]       = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [delivered, setDelivered] = useState(false);
  // null = unknown (loading), true = show, false = hide
  const [hasPartner, setHasPartner] = useState<boolean | null>(null);

  const nameRef  = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const descRef  = useRef<HTMLTextAreaElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  // Only eligible service categories can ever show the button
  const isEligible = LEAD_ELIGIBLE.has(category);

  useEffect(() => {
    if (!isEligible) return;
    const partnerCategory = businessCategoryToPartnerCategory(category);
    const key = `${partnerCategory}:${businessId}`;
    const cached = coverageCache.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      coverageCache.set(key, {
        expiresAt: Date.now() + 300_000,
        promise: fetchCoverage(partnerCategory, businessId),
      });
    }
    let canceled = false;
    setHasPartner(null);
    coverageCache.get(key)!.promise.then(value => { if (!canceled) setHasPartner(value); });
    return () => { canceled = true; };
  }, [isEligible, category, businessId]);

  useEffect(() => {
    if (!isOpen || !isEligible || hasPartner !== true) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    nameRef.current?.focus();

    function focusFirst() {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }

    function getFocusable() {
      return Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter(element => element.tabIndex >= 0);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!dialogRef.current?.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (!dialogRef.current?.contains(event.target as Node)) focusFirst();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [isEligible, hasPartner, isOpen]);

  useEffect(() => {
    if (isOpen && submitted) doneRef.current?.focus();
  }, [isOpen, submitted]);

  // Don't render if category is ineligible, or if coverage check is still
  // pending (null) or confirmed false.
  if (!isEligible || hasPartner !== true) return null;

  const ctaLabel = CATEGORY_CTA[category] ?? 'Request a Quote';

  function close() {
    setIsOpen(false);
    setSubmitted(false);
    setDelivered(false);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name        = nameRef.current?.value.trim()  ?? '';
    const phone       = phoneRef.current?.value.trim() ?? '';
    const description = descRef.current?.value.trim()  ?? '';

    if (!name)        { setError('Please enter your name.');                  return; }
    if (!phone)       { setError('Please enter a phone number.');             return; }
    if (!description) { setError('Please describe what you need.');           return; }
    if (!consentRef.current?.checked) {
      setError('Please confirm the service area and agree to local partner sharing.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/lead-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name:       name,
          contact_phone:      phone,
          description,
          business_place_id:  businessId,
          // Map the ranking-side BusinessCategory (e.g. "automotive",
          // "home_services") to the partner taxonomy slug stored in the
          // `partners` table (e.g. "auto-repair", "general-contractor").
          // The API normalizes again server-side for defense in depth.
          category:           businessCategoryToPartnerCategory(category),
          share_with_local_partners: true,
        }),
      });

      const data = await res.json().catch(() => ({})) as { error?: string; delivered?: boolean };
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Unable to send request. Please try again.');
      } else {
        setDelivered(data.delivered === true);
        setSubmitted(true);
      }
    } catch {
      setError('Unable to send request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Trigger button — full width, sits below card content */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(true)}
        className="mt-3 w-full rounded-xl bg-[#8B5E3C] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#7A5235] min-h-[44px]"
      >
        {ctaLabel}
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            tabIndex={-1}
            className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
          >

            {/* Header */}
            <div className="flex shrink-0 items-start justify-between px-5 pt-5 pb-4 border-b border-[#EDE8E3]">
              <div>
                <div className="text-[10px] text-[#7A6B63] uppercase tracking-widest font-mono mb-0.5">
                  {ctaLabel}
                </div>
                <h2 id={`${id}-title`} className="font-display text-base font-semibold text-[#241C15] leading-snug max-w-[260px]">
                  {businessName}
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="ml-4 mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#9A8C85] transition-colors hover:bg-[#FAF7F0] hover:text-[#241C15]"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              {submitted ? (
                /* Success state */
                <div className="py-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#2F6F4E]/10">
                    <span className="text-xl text-[#2F6F4E]">✓</span>
                  </div>
                  <p className="font-display font-semibold text-[#241C15] mb-1">Request received</p>
                  <p className="text-sm text-[#7A6B63] leading-relaxed">
                    {delivered
                      ? 'Matching local partners were notified and may contact you directly. The business you were viewing is not guaranteed to receive the request.'
                      : 'Your request was saved, but no partner was notified. You can contact a provider directly if you need immediate help.'}
                  </p>
                  <button
                    ref={doneRef}
                    onClick={close}
                    className="mt-5 min-h-[44px] px-3 text-sm text-[#8B5E3C] hover:underline"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Request form */
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label htmlFor={`${id}-name`} className="mb-1 block text-xs font-medium text-[#5A4A3F]">
                      Your name
                    </label>
                    <input
                      ref={nameRef}
                      id={`${id}-name`}
                      aria-describedby={error ? `${id}-error` : undefined}
                      type="text"
                      placeholder="Jane Smith"
                      autoComplete="name"
                      maxLength={120}
                      className="min-h-[44px] w-full rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-3 py-2.5 text-sm text-[#241C15] placeholder:text-[#C2B8B0] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30"
                    />
                  </div>

                  <div>
                    <label htmlFor={`${id}-phone`} className="mb-1 block text-xs font-medium text-[#5A4A3F]">
                      Phone number
                    </label>
                    <input
                      ref={phoneRef}
                      id={`${id}-phone`}
                      aria-describedby={error ? `${id}-error` : undefined}
                      type="tel"
                      placeholder="(555) 000-0000"
                      autoComplete="tel"
                      maxLength={30}
                      className="min-h-[44px] w-full rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-3 py-2.5 text-sm text-[#241C15] placeholder:text-[#C2B8B0] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30"
                    />
                  </div>

                  <div>
                    <label htmlFor={`${id}-description`} className="mb-1 block text-xs font-medium text-[#5A4A3F]">
                      What do you need?
                    </label>
                    <textarea
                      ref={descRef}
                      id={`${id}-description`}
                      aria-describedby={error ? `${id}-error` : undefined}
                      placeholder="Briefly describe the job or service you're looking for..."
                      rows={3}
                      maxLength={600}
                      className="w-full resize-none rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-3 py-2.5 text-sm text-[#241C15] placeholder:text-[#C2B8B0] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30"
                    />
                  </div>

                  <label htmlFor={`${id}-consent`} className="flex min-h-[44px] items-start gap-2 text-xs text-[#5A4A3F]">
                    <input ref={consentRef} id={`${id}-consent`} type="checkbox" required aria-describedby={error ? `${id}-error` : undefined} className="mt-0.5" />
                    <span>
                      I need service near {businessName}{businessAddress ? ` (${businessAddress})` : ''}.
                      I agree to share my contact details and request with matching local partners
                      covering this area, not necessarily this business.
                    </span>
                  </label>

                  {error && (
                    <p id={`${id}-error`} role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[44px] w-full rounded-xl bg-[#8B5E3C] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#7A5235] disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Send Request'}
                  </button>

                  <p className="text-center text-[10px] text-[#9A8C85]">
                    Only matching local partners receive your contact information.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
