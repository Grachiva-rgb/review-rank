import Link from 'next/link';
import NavLogo from '@/components/NavLogo';

// Access to this page is protected by HTTP Basic Auth in middleware.ts.
// Any request reaching this component is already authenticated.

interface Lead {
  id: string;
  business_name: string;
  business_place_id: string | null;
  category: string;
  contact_name: string;
  contact_phone: string;
  description: string | null;
  status: string;
  created_at: string;
}

async function getLeads(): Promise<Lead[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) return [];

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/leads?select=*&order=created_at.desc&limit=200`,
      {
        headers: {
          'apikey':        supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      console.error('[admin/leads] Supabase fetch error:', res.status);
      return [];
    }

    return (await res.json()) as Lead[];
  } catch (err) {
    console.error('[admin/leads] Error fetching leads:', err);
    return [];
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  plumbing:      'Plumbing',
  hvac:          'HVAC',
  electrical:    'Electrical',
  roofing:       'Roofing',
  legal:         'Legal',
  automotive:    'Automotive',
  home_services: 'Home Services',
  medical:       'Medical',
  general:       'General',
};

export default async function AdminLeadsPage() {
  const leads = await getLeads();
  const supabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Group counts by category for quick overview
  const categoryCounts: Record<string, number> = {};
  for (const lead of leads) {
    categoryCounts[lead.category] = (categoryCounts[lead.category] ?? 0) + 1;
  }
  const newCount = leads.filter((l) => l.status === 'new').length;

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/"><NavLogo size="sm" /></Link>
          <span className="text-[#D9CEC8]">/</span>
          <Link
            href="/admin/reports"
            className="text-sm text-[#7A6B63] hover:text-[#8B5E3C] transition-colors"
          >
            Reports
          </Link>
          <span className="text-[#D9CEC8]">/</span>
          <span className="text-sm text-[#241C15] font-medium">Leads</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl text-[#241C15]">Quote Requests</h1>
            <p className="text-sm text-[#7A6B63] mt-1">Inbound leads from business cards</p>
          </div>
          <div className="flex items-center gap-3">
            {newCount > 0 && (
              <span className="rounded-full bg-[#8B5E3C] px-3 py-1 text-xs font-semibold text-white">
                {newCount} new
              </span>
            )}
            <span className="font-mono text-sm text-[#7A6B63]">{leads.length} total</span>
          </div>
        </div>

        {!supabaseConfigured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-700">
            Supabase is not configured. Leads are logged to the server console only.
          </div>
        )}

        {/* Category summary chips */}
        {Object.keys(categoryCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(categoryCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <span
                  key={cat}
                  className="rounded-full border border-[#EDE8E3] bg-white px-3 py-1 text-xs text-[#5A4A3F]"
                >
                  {CATEGORY_LABEL[cat] ?? cat} &middot; {count}
                </span>
              ))}
          </div>
        )}

        {/* Lead list */}
        {leads.length === 0 ? (
          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-10 text-center shadow-sm">
            <p className="text-[#7A6B63] text-sm">No leads yet.</p>
            <p className="text-xs text-[#9A8C85] mt-1">
              Quote request buttons appear on business cards for established service businesses.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="rounded-2xl border border-[#EDE8E3] bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-[#241C15] text-sm">{lead.business_name}</p>
                    <p className="text-xs text-[#7A6B63] mt-0.5">
                      {lead.contact_name}
                      {' · '}
                      <a
                        href={`tel:${lead.contact_phone}`}
                        className="hover:text-[#8B5E3C] transition-colors"
                      >
                        {lead.contact_phone}
                      </a>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <span className="rounded border border-[#EDE8E3] bg-[#FAF7F0] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#7A6B63]">
                      {CATEGORY_LABEL[lead.category] ?? lead.category}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                        lead.status === 'new'
                          ? 'border-[#2F6F4E]/20 bg-[#2F6F4E]/5 text-[#2F6F4E]'
                          : 'border-[#EDE8E3] bg-[#FAF7F0] text-[#7A6B63]'
                      }`}
                    >
                      {lead.status}
                    </span>
                    <span className="font-mono text-xs text-[#9A8C85]">
                      {new Date(lead.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day:   'numeric',
                        year:  'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {lead.description && (
                  <p className="mt-2 border-t border-[#F0EBE6] pt-2 text-xs text-[#5A4A3F] leading-relaxed">
                    {lead.description}
                  </p>
                )}

                {lead.business_place_id && (
                  <p className="mt-1 font-mono text-[10px] text-[#C2B8B0]">
                    Place ID: {lead.business_place_id}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
