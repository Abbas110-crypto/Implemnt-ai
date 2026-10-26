import { createAdminClient, isOptions, jsonResponse, preflightResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    const { milestone_id, client_id, portal_token, author_name, content, mentions } = await req.json();
    if (!milestone_id || !client_id || !content?.trim() || typeof portal_token !== 'string') {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }
    const admin = createAdminClient();
    const { data: client } = await admin.from('clients').select('id,tenant_id')
      .eq('id', client_id).eq('portal_access_token', portal_token).maybeSingle();
    if (!client) return jsonResponse({ error: 'Invalid portal link' }, 401);
    const { data: milestone } = await admin.from('milestones').select('id')
      .eq('id', milestone_id).eq('client_id', client.id).eq('tenant_id', client.tenant_id).maybeSingle();
    if (!milestone) return jsonResponse({ error: 'Milestone not found' }, 404);
    const { data: comment, error } = await admin.from('milestone_comments').insert({
      tenant_id: client.tenant_id,
      milestone_id,
      client_id,
      author_name: String(author_name || 'Client').slice(0, 120),
      content: String(content).trim().slice(0, 5000),
      mentions: Array.isArray(mentions) ? mentions.slice(0, 20) : [],
      is_internal: false,
    }).select('id,milestone_id,client_id,author_name,content,mentions,is_internal,created_date').single();
    if (error) throw error;
    return jsonResponse({ comment });
  } catch (error) {
    console.error('Portal comment create failed:', error);
    return jsonResponse({ error: 'Could not post your comment' }, 500);
  }
});
