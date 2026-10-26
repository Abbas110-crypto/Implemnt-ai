import { isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';
import { analyzeTranscript } from '../_shared/analysis.ts';

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;

  try {
    const { call_log_id } = await req.json();
    if (!call_log_id) return jsonResponse({ error: 'call_log_id required' }, 400);
    const { data: callLog, error: callError } = await auth.userClient
      .from('call_logs').select('*').eq('id', call_log_id).single();
    if (callError || !callLog) return jsonResponse({ error: 'Call not found' }, 404);

    let transcript = callLog.notes || '';
    if (callLog.transcript_url) {
      try {
        const apiKey = Deno.env.get('RECALL_API_KEY');
        const response = await fetch(callLog.transcript_url, {
          headers: apiKey ? { Authorization: `Token ${apiKey}` } : {},
        });
        if (response.ok) {
          const body = await response.json();
          const segments = Array.isArray(body) ? body : body?.results || body?.transcript || [];
          if (Array.isArray(segments)) {
            transcript = segments.map((segment) => {
              const words = segment.words?.map((word: { text?: string }) => word.text).join(' ');
              return `${segment.speaker || 'Speaker'}: ${words || segment.text || ''}`;
            }).join('\n') || transcript;
          } else if (typeof segments === 'string') transcript = segments;
        }
      } catch (error) {
        console.error('Could not download the Recall transcript:', error);
      }
    }
    if (!transcript.trim()) return jsonResponse({ error: 'No transcript available to analyze' }, 400);

    const [{ data: riskKeywords }, { data: milestones }] = await Promise.all([
      auth.userClient.from('risk_keywords').select('keyword,severity,active').eq('tenant_id', auth.user.id),
      auth.userClient.from('milestones').select('id,title,status').eq('client_id', callLog.client_id),
    ]);
    const analysis = analyzeTranscript(transcript, riskKeywords || [], milestones || []);
    const { error: updateError } = await auth.userClient.from('call_logs').update({
      notes: callLog.notes || transcript.slice(0, 15000),
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      action_items: analysis.action_items,
      milestone_updates: analysis.milestone_updates,
      risk_flags: analysis.risk_flags,
    }).eq('id', call_log_id);
    if (updateError) throw updateError;

    const milestoneResults = await Promise.all(analysis.milestone_updates.map((update) => auth.userClient.from('milestones').update({
      status: update.new_status,
      auto_updated: true,
      update_source_call_id: call_log_id,
      completed_date: update.new_status === 'completed' ? new Date().toISOString().slice(0, 10) : null,
    }).eq('id', update.milestone_id)));
    const milestoneError = milestoneResults.find((result) => result.error)?.error;
    if (milestoneError) throw milestoneError;

    if (analysis.risk_flags.length) {
      const actionRows = analysis.risk_flags.map((flag) => ({
        tenant_id: auth.user.id,
        client_id: callLog.client_id,
        call_id: call_log_id,
        call_type: 'call_log',
        title: `Review risk: ${flag.keyword}`,
        description: flag.context,
        triggered_by_keywords: [flag.keyword],
        severity: flag.severity,
        risk_category: 'other',
        status: 'pending_review',
        context_snippet: flag.context,
      }));
      const { error } = await auth.userClient.from('action_items').insert(actionRows);
      if (error) console.error('Could not create risk review items:', error.message);
    }

    return jsonResponse({ ok: true, analysis });
  } catch (error) {
    console.error('Call analysis failed:', error);
    return jsonResponse({ error: 'Could not analyze this call' }, 500);
  }
});
