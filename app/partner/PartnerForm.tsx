'use client';

import { useState } from 'react';
import { track } from '@/components/PostHogProvider';

const CATEGORIES = [
  'landscaping', 'plumbing', 'electrical', 'hvac', 'roofing',
  'cleaning', 'painting', 'auto repair', 'pest control',
  'moving', 'general contractor', 'other',
];

export default function PartnerForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      business_name:        String(fd.get('business_name') || '').trim(),
      contact_email:        String(fd.get('contact_email') || '').trim(),
      contact_phone:        String(fd.get('contact_phone') || '').trim(),
      category:             String(fd.get('category') || '').trim(),
      city:                 String(fd.get('city') || '').trim(),
      state:                String(fd.get('state') || '').trim(),
      service_radius_miles: Number(fd.get('service_radius_miles') || 25),
    };

    if (!payload.business_name || !payload.contact_email || !payload.category) {
      setError('Business name, email, and category are required.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/partner/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start checkout. Please try again.');
        setSubmitting(false);
        return;
      }
      track.partnerCheckoutStarted({
        category: payload.category,
        city: payload.city,
      });
      window.location.href = data.url;
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Business name *" name="business_name" required />
        <Field label="Category *" name="category" type="select" options={CATEGORIES} required />
        <Field label="Contact email *" name="contact_email" type="email" required />
        <Field label="Contact phone" name="contact_phone" type="tel" />
        <Field label="City" name="city" />
        <Field label="State" name="state" placeholder="TX" maxLength={2} />
        <Field
          label="Service radius (miles)"
          name="service_radius_miles"
          type="number"
          defaultValue="25"
          min={1}
          max={200}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-[#8B5E3C] hover:bg-[#6B4A2F] text-white text-sm font-semibold px-5 py-3.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Starting checkout…' : 'Continue to secure checkout — $99/month'}
        </button>
        <p className="text-xs text-[#7A6B63] mt-3 text-center">
          You'll be redirected to Stripe to complete payment. Cancel anytime from your dashboard.
        </p>
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  min?: number;
  max?: number;
  maxLength?: number;
}

function Field({
  label, name, type = 'text', required, placeholder, options, defaultValue, min, max, maxLength,
}: FieldProps) {
  const base =
    'w-full rounded-xl border border-[#D9CEC8] bg-white px-3.5 py-2.5 text-sm text-[#241C15] focus:outline-none focus:border-[#8B5E3C] focus:ring-2 focus:ring-[#8B5E3C]/20 transition-colors';
  return (
    <label className="block">
      <span className="text-xs text-[#5A4A3F] font-medium mb-1.5 block">{label}</span>
      {type === 'select' && options ? (
        <select name={name} required={required} defaultValue="" className={base}>
          <option value="" disabled>Choose…</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          min={min}
          max={max}
          maxLength={maxLength}
          className={base}
        />
      )}
    </label>
  );
}
