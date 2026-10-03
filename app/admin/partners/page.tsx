import Link from 'next/link';
import NavLogo from '@/components/NavLogo';
import { sbSelect, isSupabaseConfigured } from '@/lib/supabase';
import { PARTNER_CATEGORY_LABELS } from '@/lib/categories';

// Protected by HTTP Basic Auth in middleware.ts. Until this page existed the
// operator could not see who was paying without opening Supabase or Stripe
// directly — paid-but-pending partners were invisible.

export const dynamic = 'force-dynamic';

interface Partner {
  id: string;
  business_name: string;
  contact_email: string;
  category: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  service_radius_miles: number | null;
  status: string;
  stripe_subscription_id: string | null;
  created_at: string;
  activated_at: string | null;
}

async function getPartners(): Promise<Partner[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    return await sbSelect<Partner>(
      'partners',
      'select=id,business_name,contact_email,category,city,state,latitude,longitude,service_radius_miles,status,stripe_subscription_id,created_at,activated_at&order=created_at.desc&limit=200'
    );
  } catch {
    return [];
  }
}

const STATUS_STYLE: Record<string, string> = {
  active: 'border-[#2F6F4E]/20 bg-[#2F6F4E]/5 text-[#2F6F4E]',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  past_due: 'border-red-200 bg-red-50 text-red-700',
  canceled: 'border-[#EDE8E3] bg-[#FAF7F0] text-[#9A8C85]',
  abandoned: 'border-[#EDE8E3] bg-[#FAF7F0] text-[#9A8C85]',
};

export default async function AdminPartnersPage() {
  const partners = await getPartners();
  const active = partners.filter((p) => p.status === 'active').length;
  const attention = partners.filter((p) => p.status === 'pending' || p.status === 'past_due').length;

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/"><NavLogo size="sm" /></Link>
          <span className="text-[#D9CEC8]">/</span>
          <Link href="/admin/leads" className="text-sm text-[#7A6B63] hover:text-[#8B5E3C] transition-colors">Leads</Link>
          <span className="text-[#D9CEC8]">/</span>
          <Link href="/admin/reports" className="text-sm text-[#7A6B63] hover:text-[#8B5E3C] transition-colors">Reports</Link>
          <span className="text-[#D9CEC8]">/</span>
          <span className="text-sm text-[#241C15] font-medium">Partners</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl text-[#241C15]">Partners</h1>
            <p className="text-sm text-[#7A6B63] mt-1">
              {active} active · {attention > 0 ? `${attention} need attention` : 'none need attention'}
            </p>
          </div>
          <span className="font-mono text-sm text-[#7A6B63]">{partners.length} total</span>
        </div>

        {partners.length === 0 ? (
          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-10 text-center shadow-sm">
            <p className="text-[#7A6B63] text-sm">No partners yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {partners.map((p) => (
              <div key={p.id} className="rounded-2xl border border-[#EDE8E3] bg-white px-5 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-[#241C15] text-sm">{p.business_name}</p>
                    <p className="text-xs text-[#7A6B63] mt-0.5">
                      <a href={`mailto:${p.contact_email}`} className="hover:text-[#8B5E3C]">{p.contact_email}</a>
                      {' · '}{p.city}, {p.state}
                      {p.service_radius_miles ? ` · ${p.service_radius_miles} mi radius` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <span className="rounded border border-[#EDE8E3] bg-[#FAF7F0] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#7A6B63]">
                      {(PARTNER_CATEGORY_LABELS as Record<string, string>)[p.category] ?? p.category}
                    </span>
                    <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${STATUS_STYLE[p.status] ?? STATUS_STYLE.canceled}`}>
                      {p.status}
                    </span>
                    <span className="font-mono text-xs text-[#9A8C85]">
                      {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 border-t border-[#F0EBE6] pt-2 text-[11px] text-[#7A6B63] flex-wrap">
                  <span>
                    {p.latitude != null && p.longitude != null
                      ? 'Geo matching: ON'
                      : 'Geo matching: OFF — receives NATIONWIDE category leads'}
                  </span>
                  <span className="font-mono text-[#C2B8B0]">
                    {p.stripe_subscription_id ? `sub: ${p.stripe_subscription_id}` : 'no subscription id'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
