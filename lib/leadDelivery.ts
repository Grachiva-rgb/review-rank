import { Resend } from 'resend';
import { isSupabaseConfigured, sbInsert } from './supabase';
import { findMatchingPartners, isCoordinates, type PartnerRow } from './partnerMatching';

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
 * Match + deliver. The route awaits this before returning in serverless.
 * Returns successful deliveries; errors never cause a category-wide fallback.
 */
export async function deliverLeadToPartners(lead: LeadPayload): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS || 'ReviewRank Leads <leads@reviewrank.app>';
  const location = { lat: lead.lat, lng: lead.lng };
  if (!isCoordinates(location)) return 0;

  let partners: PartnerRow[] = [];
  try {
    partners = await findMatchingPartners(lead.category, location);
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
