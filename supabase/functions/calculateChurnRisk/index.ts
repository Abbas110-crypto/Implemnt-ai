import { isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';

type Keyword = { keyword: string; severity: string; category: string; active: boolean };

function scoreRisks(text: string, keywords: Keyword[]) {
  const normalized = text.toLowerCase();
  const matched = keywords.filter((item) => item.active && item.keyword && normalized.includes(item.keyword.toLowerCase()));
  const score = Math.min(100, matched.reduce((total, item) => total + (item.severity === 'high' ? 30 : item.severity === 'medium' ? 15 : 5), 0));
  const level = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { score, level, matched };
}

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const { client_id } = await req.json().catch(() => ({}));
    let clientQuery = auth.userClient.from('clients').select('id,company_name').eq('tenant_id', auth.user.id);
    if (client_id) clientQuery = clientQuery.eq('id', client_id);
    const { data: clients, error: clientsError } = await clientQuery;
    if (clientsError) throw clientsError;
    const { data: keywords, error: keywordError } = await auth.userClient.from('risk_keywords')
      .select('keyword,severity,category,active').eq('tenant_id', auth.user.id).eq('active', true);
    if (keywordError) throw keywordError;

    const results = [];
    for (const client of clients || []) {
      const [calls, gongCalls] = await Promise.all([
        auth.userClient.from('call_logs').select('notes,summary').eq('tenant_id', auth.user.id).eq('client_id', client.id),
        auth.userClient.from('gong_calls').select('transcript,summary').eq('tenant_id', auth.user.id).eq('client_id', client.id),
      ]);
      if (calls.error) throw calls.error;
      if (gongCalls.error) throw gongCalls.error;
      const allText = [
        ...(calls.data || []).map((call) => `${call.notes || ''} ${call.summary || ''}`),
        ...(gongCalls.data || []).map((call) => `${call.transcript || ''} ${call.summary || ''}`),
      ].join(' ');
      const result = scoreRisks(allText, keywords || []);
      const { error: updateError } = await auth.userClient.from('clients').update({
        churn_risk_score: result.score,
        churn_risk_level: result.level,
      }).eq('tenant_id', auth.user.id).eq('id', client.id);
      if (updateError) throw updateError;
      results.push({
        client_id: client.id,
        company: client.company_name,
        churn_risk_score: result.score,
        churn_risk_level: result.level,
        matched_keywords: result.matched.map((item) => ({ keyword: item.keyword, severity: item.severity, category: item.category })),
      });
    }
    return jsonResponse({ success: true, results });
  } catch (error) {
    console.error('Risk calculation failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Could not calculate churn risk' }, 500);
  }
});
