import { createAdminClient, isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';
import { getHubspotAccessToken, hubspotTokenRequest } from '../_shared/hubspot.ts';

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  const admin = createAdminClient();
  try {
    const body = await req.json().catch(() => ({}));
    const clientId = Deno.env.get('HUBSPOT_CLIENT_ID');
    const clientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET');
    if (body.action === 'get_status') {
      const [{ data: connection, error }, { data: credential, error: secretError }] = await Promise.all([
        admin.from('hubspot_connections').select('hub_id').eq('tenant_id', auth.user.id).maybeSingle(),
        admin.from('integration_credentials').select('id').eq('tenant_id', auth.user.id)
          .eq('platform', 'hubspot').eq('credential_name', 'oauth_tokens').maybeSingle(),
      ]);
      if (error || secretError) throw error || secretError;
      const shared = Deno.env.get('HUBSPOT_SHARED_TENANT_ID') === auth.user.id && Boolean(Deno.env.get('HUBSPOT_API_TOKEN'));
      return jsonResponse({ connected: Boolean(connection && credential) || shared,
        hub_id: connection?.hub_id || null, mode: credential ? 'oauth' : shared ? 'workspace' : null,
        setup_required: !clientId || !clientSecret });
    }
    if (body.action === 'test') {
      const token = await getHubspotAccessToken(auth.user.id);
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HubSpot connection test failed (${response.status})`);
      return jsonResponse({ success: true });
    }
    if (!clientId || !clientSecret) return jsonResponse({ error: 'HubSpot OAuth app credentials are not configured on the server.' }, 503);
    if (body.action === 'get_auth_url') {
      if (!body.redirect_uri || !body.state) return jsonResponse({ error: 'OAuth redirect and state are required.' }, 400);
      const url = new URL('https://app.hubspot.com/oauth/authorize');
      url.search = new URLSearchParams({
        client_id: clientId, redirect_uri: body.redirect_uri,
        scope: 'crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read crm.objects.deals.write',
        state: body.state,
      }).toString();
      return jsonResponse({ auth_url: url.toString() });
    }
    if (body.action === 'exchange_code') {
      if (!body.code || !body.redirect_uri) return jsonResponse({ error: 'OAuth callback details are missing.' }, 400);
      const tokens = await hubspotTokenRequest({
        grant_type: 'authorization_code', code: body.code, redirect_uri: body.redirect_uri,
        client_id: clientId, client_secret: clientSecret,
      });
      if (!tokens.hub_id) throw new Error('HubSpot did not return an account ID.');
      const { error: tokenError } = await admin.from('integration_credentials').upsert({
        tenant_id: auth.user.id, platform: 'hubspot', credential_name: 'oauth_tokens',
        secret_value: JSON.stringify({
          access_token: tokens.access_token, refresh_token: tokens.refresh_token,
          expires_at: Date.now() + Number(tokens.expires_in || 1800) * 1000,
        }),
      }, { onConflict: 'tenant_id,platform,credential_name' });
      if (tokenError) throw tokenError;
      const { error: connectionError } = await admin.from('hubspot_connections').upsert({
        tenant_id: auth.user.id, hub_id: Number(tokens.hub_id),
      }, { onConflict: 'tenant_id' });
      if (connectionError) throw connectionError;
      return jsonResponse({ success: true, hub_id: Number(tokens.hub_id) });
    }
    if (body.action === 'disconnect') {
      const { data: credential } = await admin.from('integration_credentials').select('secret_value')
        .eq('tenant_id', auth.user.id).eq('platform', 'hubspot').eq('credential_name', 'oauth_tokens').maybeSingle();
      if (credential?.secret_value) {
        const tokens = JSON.parse(credential.secret_value);
        if (tokens.refresh_token) {
          const response = await fetch('https://api.hubapi.com/oauth/2026-03/token/revoke', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret,
              token: tokens.refresh_token, token_type_hint: 'refresh_token' }),
          });
          if (!response.ok) throw new Error(`HubSpot token revocation failed (${response.status})`);
        }
      }
      const [tokenDelete, connectionDelete] = await Promise.all([
        admin.from('integration_credentials').delete().eq('tenant_id', auth.user.id).eq('platform', 'hubspot'),
        admin.from('hubspot_connections').delete().eq('tenant_id', auth.user.id),
      ]);
      if (tokenDelete.error || connectionDelete.error) throw tokenDelete.error || connectionDelete.error;
      return jsonResponse({ success: true });
    }
    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('HubSpot OAuth request failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'HubSpot connection failed' }, 500);
  }
});
