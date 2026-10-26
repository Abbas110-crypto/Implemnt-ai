import { createAdminClient, isOptions, jsonResponse, preflightResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    const { token } = await req.json();
    if (typeof token !== 'string' || !/^[a-f0-9]{48}$/i.test(token)) return jsonResponse({ error: 'Invalid portal link' }, 401);
    const admin = createAdminClient();
    const { data: client, error } = await admin.from('clients')
      .select('id,tenant_id,company_name,contact_name,onboarding_stage,health_score,target_go_live,portal_access_token')
      .eq('portal_access_token', token).maybeSingle();
    if (error) throw error;
    if (!client) return jsonResponse({ error: 'Client portal not found' }, 404);
    const { data: milestones, error: milestonesError } = await admin.from('milestones')
      .select('id,client_id,title,description,stage,status,due_date,completed_date,owner,sort_order')
      .eq('tenant_id', client.tenant_id).eq('client_id', client.id).order('sort_order');
    if (milestonesError) throw milestonesError;
    delete client.portal_access_token;
    delete client.tenant_id;
    return jsonResponse({ client, milestones: milestones || [] });
  } catch (error) {
    console.error('Client portal read failed:', error);
    return jsonResponse({ error: 'Could not load this client portal' }, 500);
  }
});
