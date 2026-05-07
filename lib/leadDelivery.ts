import { Resend } from 'resend';
import { isSupabaseConfigured, sbInsert, sbSelect } from './supabase';

interface PartnerRow {
  id: string;
  business_name: string;
  contact_email: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  service_radius_miles: number;
}

interface LeadPayload {
  leadId?: string;
  category: string;
  businessName: string;   // the business the customer was viewing
  contactName: string;
  contactPhone: string;
  description: string;
  lat?: number;
  lng?: number;
}

function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8; // Earth radius, miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Find active partners in the given category. If lat/lng is provided, filter
 * by each partner's configured service radius. Otherwise return all partners
 * in that category (coverage-wide fallback).
 */
async function findMatchingPartners(
  category: string,
  lat?: number,
  lng?: number
): Promise<PartnerRow[]> {
  if (!isSupabaseConfigured()) return [];
  const rows = await sbSelect<PartnerRow>(
    'partners',
    `select=id,business_name,contact_email,category,latitude,longitude,service_radius_miles&status=eq.active&category=eq.${encodeURIComponent(
      category
    )}`
  );
  if (typeof lat !== 'number' || typeof lng !== 'number') return rows;
  return rows.filter((p) => {
    if (p.latitude == null || p.longitude == null) return true;
    const d = milesBetween({ lat, lng }, { lat: p.latitude, lng: p.longitude });
    return d <= p.service_radius_miles;
  });
}

function leadHtml(lead: LeadPayload, partner: PartnerRow): string {
  const safe = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; background: #FAF7F0; padding: 24px; color: #241C15;">
      <div style="background: white; border: 1px solid #EDE8E3; border-radius: 16px; padding: 28px;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #8B5E3C; font-weight: 600; margin-bottom: 8px;">
          New matched lead · ReviewRank
        </div>
        <h1 style="font-size: 22px; margin: 0 0 16px; line-height: 1.3;">
          ${safe(lead.contactName)} needs a ${safe(lead.category)} quote
        </h1>
        <table style="width: 100%; font-size: 14px; line-height: 1.6; border-collapse: collapse;">
          <tr><td style="color: #7A6B63; width: 110px; padding: 4px 0;">Phone</td><td><a href="tel:${safe(
            lead.contactPhone
          )}" style="color: #8B5E3C;">${safe(lead.contactPhone)}</a></td></tr>
          <tr><td style="color: #7A6B63; padding: 4px 0;">Viewing</td><td>${safe(lead.businessName)}</td></tr>
          <tr><td style="color: #7A6B63; padding: 4px 0; vertical-align: top;">Request</td><td style="white-space: pre-wrap;">${safe(
            lead.description
          )}</td></tr>
        </table>
        <p style="font-size: 12px; color: #7A6B63; margin-top: 20px; border-top: 1px solid #EDE8E3; padding-top: 16px;">
          This lead was matched to <strong>${safe(partner.business_name)}</strong> based on your category (${safe(
          partner.category
        )}) and service area.
          Reply within an hour — matched leads convert best on first contact.
        </p>
      </div>
      <p style="font-size: 11px; color: #9A8C85; text-align: center; margin-top: 16px;">
        ReviewRank Partner Program · <a style="color: #9A8C85;" href="mailto:partners@reviewrank.app">partners@reviewrank.app</a>
      </p>
    </div>
  `;
}

/**
 * Match + deliver. Best-effort, non-blocking — errors are logged but never
 * thrown to the caller. Returns the number of deliveries attempted.
 */
export async function deliverLeadToPartners(lead: LeadPayload): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS || 'ReviewRank Leads <leads@reviewrank.app>';

  let partners: PartnerRow[] = [];
  try {
    partners = await findMatchingPartners(lead.category, lead.lat, lead.lng);
  } catch (err) {
    console.error('[leadDelivery] partner lookup failed:', err);
    return 0;
  }

  if (partners.length === 0) return 0;
  if (!apiKey) {
    console.log(`[leadDelivery] Resend not configured; would deliver to ${partners.length} partner(s).`);
    return 0;
  }

  const resend = new Resend(apiKey);
  let delivered = 0;

  for (const partner of partners) {
    let status: 'sent' | 'failed' = 'failed';
    let resendId: string | null = null;
    let errorMessage: string | null = null;

    try {
      const result = await resend.emails.send({
        from: fromAddress,
        to: partner.contact_email,
        subject: `New ${lead.category} lead — ${lead.contactName}`,
        html: leadHtml(lead, partner),
      });
      if (result.error) {
        errorMessage = result.error.message || String(result.error);
      } else {
        status = 'sent';
        resendId = result.data?.id || null;
        delivered++;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    if (isSupabaseConfigured() && lead.leadId) {
      try {
        await sbInsert('lead_deliveries', {
          lead_id: lead.leadId,
          partner_id: partner.id,
          email_status: status,
          resend_id: resendId,
          error_message: errorMessage,
        });
      } catch (err) {
        console.error('[leadDelivery] delivery row insert failed:', err);
      }
    }
  }

  return delivered;
}
