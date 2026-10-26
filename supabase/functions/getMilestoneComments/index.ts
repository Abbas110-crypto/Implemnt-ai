import { createAdminClient, isOptions, jsonResponse, preflightResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    const { milestone_id, portal_token } = await req.json();
    if (!milestone_id || typeof portal_token !== 'string') return jsonResponse({ error: 'Invalid request' }, 400);
    const admin = createAdminClient();
    const { data: client } = await admin.from('clients').select('id,tenant_id')
      .eq('portal_access_token', portal_token).maybeSingle();
    if (!client) return jsonResponse({ error: 'Invalid portal link' }, 401);
    const { data: milestone } = await admin.from('milestones').select('id')
      .eq('id', milestone_id).eq('client_id', client.id).eq('tenant_id', client.tenant_id).maybeSingle();
    if (!milestone) return jsonResponse({ error: 'Milestone not found' }, 404);
    const { data: comments, error } = await admin.from('milestone_comments').select('*')
      .eq('tenant_id', client.tenant_id).eq('client_id', client.id)
      .eq('milestone_id', milestone_id).eq('is_internal', false).order('created_date');
    if (error) throw error;
    return jsonResponse({ comments: comments || [] });
  } catch (error) {
    console.error('Portal comments read failed:', error);
    return jsonResponse({ error: 'Could not load comments' }, 500);
  }
});
