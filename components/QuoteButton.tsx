'use client';

import { useState, useRef } from 'react';
import { BusinessCategory } from '@/lib/ranking';

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
  category: BusinessCategory;
}

export default function QuoteButton({ businessName, businessId, category }: QuoteButtonProps) {
  const [isOpen, setIsOpen]       = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  const nameRef  = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const descRef  = useRef<HTMLTextAreaElement>(null);

  // Only render for eligible service categories
  if (!LEAD_ELIGIBLE.has(category)) return null;

  const ctaLabel = CATEGORY_CTA[category] ?? 'Request a Quote';

  function close() {
    setIsOpen(false);
    setSubmitted(false);
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
          business_name:      businessName,
          business_place_id:  businessId,
          category,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Unable to send request. Please try again.');
      } else {
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
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[#EDE8E3]">
              <div>
                <div className="text-[10px] text-[#7A6B63] uppercase tracking-widest font-mono mb-0.5">
                  {ctaLabel}
                </div>
                <h2 className="font-display text-base font-semibold text-[#241C15] leading-snug max-w-[260px]">
                  {businessName}
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="ml-4 mt-0.5 flex h-11 w-11 items-center justify-center rounded-lg text-[#9A8C85] transition-colors hover:bg-[#FAF7F0] hover:text-[#241C15]"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              {submitted ? (
                /* Success state */
                <div className="py-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#2F6F4E]/10">
                    <span className="text-xl text-[#2F6F4E]">✓</span>
                  </div>
                  <p className="font-display font-semibold text-[#241C15] mb-1">Request sent</p>
                  <p className="text-sm text-[#7A6B63] leading-relaxed">
                    {businessName} will receive your request and may contact you directly.
                  </p>
                  <button
                    onClick={close}
                    className="mt-5 text-sm text-[#8B5E3C] hover:underline"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Request form */
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A4A3F]">
                      Your name
                    </label>
                    <input
                      ref={nameRef}
                      type="text"
                      placeholder="Jane Smith"
                      autoComplete="name"
                      className="min-h-[44px] w-full rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-3 py-2.5 text-sm text-[#241C15] placeholder:text-[#C2B8B0] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A4A3F]">
                      Phone number
                    </label>
                    <input
                      ref={phoneRef}
                      type="tel"
                      placeholder="(555) 000-0000"
                      autoComplete="tel"
                      className="min-h-[44px] w-full rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-3 py-2.5 text-sm text-[#241C15] placeholder:text-[#C2B8B0] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A4A3F]">
                      What do you need?
                    </label>
                    <textarea
                      ref={descRef}
                      placeholder="Briefly describe the job or service you're looking for..."
                      rows={3}
                      className="w-full resize-none rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-3 py-2.5 text-sm text-[#241C15] placeholder:text-[#C2B8B0] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30"
                    />
                  </div>

                  {error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
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
                    Your contact info will only be shared with {businessName}.
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
