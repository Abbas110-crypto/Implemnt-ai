import { createAdminClient } from './http.ts';

const tokenUrl = 'https://api.hubapi.com/oauth/2026-03/token';

export async function hubspotTokenRequest(values: Record<string, string>) {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(body.message || body.error_description || body.error || `HubSpot OAuth failed (${response.status})`);
  }
  return body;
}

export async function getHubspotAccessToken(tenantId: string) {
  const admin = createAdminClient();
  const { data: row, error } = await admin.from('integration_credentials').select('id,secret_value')
    .eq('tenant_id', tenantId).eq('platform', 'hubspot').eq('credential_name', 'oauth_tokens').maybeSingle();
  if (error) throw error;
  if (!row?.secret_value) {
    const sharedTenant = Deno.env.get('HUBSPOT_SHARED_TENANT_ID');
    const sharedToken = Deno.env.get('HUBSPOT_API_TOKEN');
    if (sharedTenant === tenantId && sharedToken) return sharedToken;
    throw new Error('HubSpot is not connected for this user. Connect it from Integrations.');
  }
  const tokens = JSON.parse(row.secret_value);
  if (tokens.access_token && Number(tokens.expires_at) > Date.now() + 5 * 60 * 1000) return tokens.access_token as string;
  const clientId = Deno.env.get('HUBSPOT_CLIENT_ID');
  const clientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET');
  if (!clientId || !clientSecret || !tokens.refresh_token) throw new Error('HubSpot connection expired. Reconnect HubSpot.');
  let refreshed;
  try {
    refreshed = await hubspotTokenRequest({
      grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
    });
  } catch (error) {
    const { data: latest } = await admin.from('integration_credentials').select('secret_value')
      .eq('id', row.id).maybeSingle();
    if (latest?.secret_value && latest.secret_value !== row.secret_value) {
      const current = JSON.parse(latest.secret_value);
      if (current.access_token && Number(current.expires_at) > Date.now()) return current.access_token;
    }
    throw error;
  }
  const next = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + Number(refreshed.expires_in || 1800) * 1000,
  };
  const { data: saved, error: saveError } = await admin.from('integration_credentials')
    .update({ secret_value: JSON.stringify(next) }).eq('id', row.id)
    .eq('secret_value', row.secret_value).select('id').maybeSingle();
  if (saveError) throw saveError;
  if (!saved) {
    const { data: latest, error: latestError } = await admin.from('integration_credentials')
      .select('secret_value').eq('id', row.id).single();
    if (latestError) throw latestError;
    return JSON.parse(latest.secret_value).access_token;
  }
  return next.access_token;
}
