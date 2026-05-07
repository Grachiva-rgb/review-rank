'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import NavLogo from '@/components/NavLogo';

// Must match the validation regex in the business detail page and API route
const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ReportForm() {
  const searchParams = useSearchParams();

  const rawBusinessId = searchParams.get('businessId') ?? '';
  const businessNameParam = searchParams.get('businessName') ?? '';

  // Validate the place ID from the URL before using it in links or API calls
  const businessIdParam = PLACE_ID_RE.test(rawBusinessId) ? rawBusinessId : '';

  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [businessName, setBusinessName] = useState(businessNameParam);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (businessNameParam) setBusinessName(businessNameParam);
  }, [businessNameParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validation — avoids a round-trip for obvious errors
    if (!businessName.trim()) {
      setErrorMessage('Please enter the business name.');
      setStatus('error');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage('Please enter your name.');
      setStatus('error');
      return;
    }
    if (!ownerEmail.trim() || !EMAIL_RE.test(ownerEmail.trim())) {
      setErrorMessage('Please enter a valid email address.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/report-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_name: ownerName,
          owner_email: ownerEmail,
          business_name: businessName,
          business_place_id: businessIdParam || undefined,
          note: note || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }

      setStatus('success');
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-8 shadow-sm">
            <div className="h-10 w-10 rounded-full bg-[#2F6F4E]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-[#2F6F4E] text-lg font-bold">✓</span>
            </div>
            <h1 className="font-display text-2xl text-[#241C15] mb-2">Request received</h1>
            <p className="text-sm text-[#7A6B63] leading-relaxed mb-6">
              We'll review your submission and be in touch at{' '}
              <span className="font-medium text-[#241C15]">{ownerEmail}</span>.
            </p>
            <Link
              href={businessIdParam ? `/business/${businessIdParam}` : '/'}
              className="inline-block text-sm text-[#8B5E3C] hover:text-[#6B4A2F] transition-colors"
            >
              ← Back {businessNameParam ? `to ${businessNameParam}` : 'to search'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/"><NavLogo size="sm" /></Link>
          <span className="text-[#D9CEC8]">/</span>
          <span className="text-sm text-[#7A6B63]">Ranking Report</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl text-[#241C15] mb-2">
            Get Your Ranking Report
          </h1>
          <p className="text-sm text-[#7A6B63] leading-relaxed">
            We'll send you a breakdown of how your business ranks, what signals drive your score,
            and how customers describe their experience.
          </p>
        </div>

        <div className="rounded-2xl border border-[#EDE8E3] bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label
                htmlFor="businessName"
                className="block text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-1.5"
              >
                Business name
              </label>
              <input
                id="businessName"
                type="text"
                required
                maxLength={120}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business name"
                className="w-full rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-4 py-2.5 text-sm text-[#241C15] placeholder:text-[#C2B8B0] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30 focus:border-[#8B5E3C] transition-colors"
                suppressHydrationWarning
              />
            </div>

            <div>
              <label
                htmlFor="ownerName"
                className="block text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-1.5"
              >
                Your name
              </label>
              <input
                id="ownerName"
                type="text"
                required
                maxLength={120}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-4 py-2.5 text-sm text-[#241C15] placeholder:text-[#C2B8B0] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30 focus:border-[#8B5E3C] transition-colors"
                suppressHydrationWarning
              />
            </div>

            <div>
              <label
                htmlFor="ownerEmail"
                className="block text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-1.5"
              >
                Email address
              </label>
              <input
                id="ownerEmail"
                type="email"
                required
                maxLength={254}
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                className="w-full rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-4 py-2.5 text-sm text-[#241C15] placeholder:text-[#C2B8B0] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30 focus:border-[#8B5E3C] transition-colors"
                suppressHydrationWarning
              />
            </div>

            <div>
              <label
                htmlFor="note"
                className="block text-xs text-[#7A6B63] uppercase tracking-widest font-mono mb-1.5"
              >
                Anything you'd like us to know{' '}
                <span className="normal-case">(optional)</span>
              </label>
              <textarea
                id="note"
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. We recently changed ownership, or we'd like to understand the review volume needed to reach Highly Trusted..."
                rows={3}
                className="w-full rounded-xl border border-[#EDE8E3] bg-[#FAF7F0] px-4 py-2.5 text-sm text-[#241C15] placeholder:text-[#C2B8B0] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30 focus:border-[#8B5E3C] transition-colors resize-none"
                suppressHydrationWarning
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full rounded-xl bg-[#8B5E3C] hover:bg-[#6B4A2F] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 transition-colors"
            >
              {status === 'submitting' ? 'Submitting...' : 'Get Ranking Report'}
            </button>
          </form>
        </div>

        <p className="text-xs text-[#9A8C85] text-center mt-4 leading-relaxed">
          Reports do not affect rankings. Rankings are based on public review signals only.
        </p>
      </main>
    </div>
  );
}
