import { isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';
import { getHubspotAccessToken } from '../_shared/hubspot.ts';

function scoreRisks(text: string, keywords: any[]) {
  const normalized = text.toLowerCase();
  const matched = keywords.filter((item) => item.active && item.keyword && normalized.includes(item.keyword.toLowerCase()));
  const score = Math.min(100, matched.reduce((total, item) => total + (item.severity === 'high' ? 30 : item.severity === 'medium' ? 15 : 5), 0));
  const level = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { score, level, matched };
}

async function syncHubSpot(contactId: string | null, dealId: string | null, properties: Record<string, string>, token: string) {
  const targets = [
    contactId ? `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(contactId)}` : null,
    dealId ? `https://api.hubapi.com/crm/v3/objects/deals/${encodeURIComponent(dealId)}` : null,
  ].filter(Boolean) as string[];
  for (const endpoint of targets) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties }),
      });
      if (response.ok) break;
      if (attempt < 2 && [429, 502, 503, 504].includes(response.status)) {
        const delay = Number(response.headers.get('Retry-After'));
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(delay) && delay > 0 ? Math.min(delay * 1000, 5000) : 500 * 2 ** attempt));
        continue;
      }
      throw new Error(`HubSpot returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
  }
}

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const { client_id } = await req.json().catch(() => ({}));
    let clientQuery = auth.userClient.from('clients').select('*').order('created_date', { ascending: false });
    if (client_id) clientQuery = clientQuery.eq('id', client_id);
    const { data: clients, error: clientsError } = await clientQuery;
    if (clientsError) throw clientsError;
    const { data: keywords, error: keywordError } = await auth.userClient.from('risk_keywords')
      .select('keyword,severity,category,active').eq('tenant_id', auth.user.id).eq('active', true);
    if (keywordError) throw keywordError;

    let token: string | null = null;
    let connectionError: string | null = null;
    try { token = await getHubspotAccessToken(auth.user.id); }
    catch (error) { connectionError = error instanceof Error ? error.message : 'HubSpot is not connected'; }
    const results = [];
    for (const client of clients || []) {
      const [calls, gongCalls] = await Promise.all([
        auth.userClient.from('call_logs').select('notes,summary').eq('client_id', client.id),
        auth.userClient.from('gong_calls').select('transcript,summary').eq('client_id', client.id),
      ]);
      if (calls.error) throw calls.error;
      if (gongCalls.error) throw gongCalls.error;
      const allText = [
        ...(calls.data || []).map((call) => `${call.notes || ''} ${call.summary || ''}`),
        ...(gongCalls.data || []).map((call) => `${call.transcript || ''} ${call.summary || ''}`),
      ].join(' ');
      const result = scoreRisks(allText, keywords || []);
      const crmProperties = {
        churn_risk_score: String(result.score),
        churn_risk_level: result.level,
        churn_risk_keywords: result.matched.map((item) => item.keyword).join(', '),
      };
      const { error: updateError } = await auth.userClient.from('clients').update({
        churn_risk_score: result.score,
        churn_risk_level: result.level,
      }).eq('id', client.id);
      if (updateError) throw updateError;

      const synced_to: string[] = [];
      const errors: string[] = [];
      if (client.hubspot_contact_id || client.hubspot_deal_id) {
        if (!token) errors.push(`HubSpot: ${connectionError}`);
        else try {
          await syncHubSpot(client.hubspot_contact_id, client.hubspot_deal_id, crmProperties, token);
          synced_to.push('hubspot');
          const { error: timestampError } = await auth.userClient.from('clients')
            .update({ last_hubspot_sync: new Date().toISOString() }).eq('id', client.id);
          if (timestampError) throw timestampError;
        } catch (error) {
          errors.push(`HubSpot: ${error instanceof Error ? error.message : 'Sync failed'}`);
        }
      }
      results.push({
        client_id: client.id,
        company: client.company_name,
        churn_risk_score: result.score,
        churn_risk_level: result.level,
        matched_keywords: result.matched.map((item) => ({ keyword: item.keyword, severity: item.severity, category: item.category })),
        synced_to,
        errors,
      });
    }
    return jsonResponse({ success: true, results });
  } catch (error) {
    console.error('Churn risk sync failed:', error);
    return jsonResponse({ error: error.message || 'Could not calculate churn risk' }, 500);
  }
});
