import { headers } from 'next/headers';
import Link from 'next/link';
import NavLogo from '@/components/NavLogo';

// Protect this page with a simple secret key check.
// Set ADMIN_SECRET in your environment to enable access.
// Access via: /admin/reports?secret=<ADMIN_SECRET>

interface ReportRequest {
  id: string;
  business_name: string;
  business_place_id: string | null;
  owner_name: string;
  owner_email: string;
  note: string | null;
  status: string;
  created_at: string;
}

async function getReportRequests(): Promise<ReportRequest[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) return [];

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/business_report_requests?select=*&order=created_at.desc&limit=200`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      console.error('[admin/reports] Supabase fetch error:', res.status);
      return [];
    }

    return (await res.json()) as ReportRequest[];
  } catch (err) {
    console.error('[admin/reports] Error fetching requests:', err);
    return [];
  }
}

interface AdminReportsPageProps {
  searchParams: Promise<{ secret?: string }>;
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const { secret } = await searchParams;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || secret !== adminSecret) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[#7A6B63] text-sm">Access denied.</p>
          <Link href="/" className="text-xs text-[#8B5E3C] hover:text-[#6B4A2F] mt-2 inline-block">
            ← Back to search
          </Link>
        </div>
      </div>
    );
  }

  const requests = await getReportRequests();
  const supabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <nav className="border-b border-[#EDE8E3] bg-[#FAF7F0]/95 backdrop-blur-md px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/"><NavLogo size="sm" /></Link>
          <span className="text-[#D9CEC8]">/</span>
          <span className="text-sm text-[#7A6B63]">Admin — Report Requests</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl text-[#241C15]">Report Requests</h1>
          <span className="font-mono text-sm text-[#7A6B63]">{requests.length} total</span>
        </div>

        {!supabaseConfigured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-700">
            Supabase is not configured. Submissions are logged to the server console only.
          </div>
        )}

        {requests.length === 0 ? (
          <div className="rounded-2xl border border-[#EDE8E3] bg-white p-10 text-center shadow-sm">
            <p className="text-[#7A6B63] text-sm">No report requests yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-[#EDE8E3] bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-[#241C15] text-sm">{req.business_name}</p>
                    <p className="text-xs text-[#7A6B63] mt-0.5">
                      {req.owner_name} &middot; <a href={`mailto:${req.owner_email}`} className="hover:text-[#8B5E3C] transition-colors">{req.owner_email}</a>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-widest rounded border px-2 py-0.5 ${
                        req.status === 'new'
                          ? 'border-[#2F6F4E]/20 bg-[#2F6F4E]/5 text-[#2F6F4E]'
                          : 'border-[#EDE8E3] bg-[#FAF7F0] text-[#7A6B63]'
                      }`}
                    >
                      {req.status}
                    </span>
                    <span className="font-mono text-xs text-[#9A8C85]">
                      {new Date(req.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                {req.note && (
                  <p className="text-xs text-[#5A4A3F] mt-2 leading-relaxed border-t border-[#F0EBE6] pt-2">
                    {req.note}
                  </p>
                )}
                {req.business_place_id && (
                  <p className="text-[10px] font-mono text-[#C2B8B0] mt-1">
                    Place ID: {req.business_place_id}
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
