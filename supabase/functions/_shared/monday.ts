import { createAdminClient } from './http.ts';

const TOKEN_URL = 'https://auth.monday.com/oauth_ms/oauth/token';

function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
    return Number.isFinite(Number(payload.exp)) ? Number(payload.exp) * 1000 : null;
  } catch { return null; }
}

export async function getMondayAccessToken(tenantId: string) {
  const admin = createAdminClient();
  const { data: credential, error } = await admin.from('integration_credentials').select('id,secret_value')
    .eq('tenant_id', tenantId).eq('platform', 'monday').eq('credential_name', 'oauth_tokens').maybeSingle();
  if (error) throw error;
  if (!credential?.secret_value) throw new Error('Monday.com is not connected. Connect it from Integrations.');
  const tokens = JSON.parse(credential.secret_value);
  const expiry = Number(tokens.expires_at) || tokenExpiry(tokens.access_token || '');
  const shouldRefresh = tokens.refresh_token && (!expiry || expiry < Date.now() + 5 * 60 * 1000);
  if (!shouldRefresh) {
    if (!tokens.access_token) throw new Error('Monday.com token is missing. Reconnect Monday.com.');
    if (expiry && expiry < Date.now() && !tokens.refresh_token) {
      throw new Error('Monday.com access expired. Reconnect Monday.com.');
    }
    return tokens.access_token as string;
  }

  const clientId = Deno.env.get('MONDAY_CLIENT_ID');
  const clientSecret = Deno.env.get('MONDAY_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Monday OAuth credentials are missing on the server.');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
    }),
  });
  const refreshed = await response.json();
  if (!response.ok || !refreshed.access_token) {
    const { data: latest } = await admin.from('integration_credentials').select('secret_value')
      .eq('id', credential.id).maybeSingle();
    if (latest?.secret_value && latest.secret_value !== credential.secret_value) {
      const current = JSON.parse(latest.secret_value);
      if (current.access_token && Number(current.expires_at) > Date.now()) return current.access_token;
    }
    throw new Error(refreshed.error_description || 'Monday access token could not be refreshed. Reconnect Monday.com.');
  }
  const latest = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || tokens.refresh_token,
    expires_at: refreshed.expires_in ? Date.now() + Number(refreshed.expires_in) * 1000 : tokenExpiry(refreshed.access_token),
    scope: refreshed.scope || tokens.scope || '',
  };
  const { data: saved, error: saveError } = await admin.from('integration_credentials')
    .update({ secret_value: JSON.stringify(latest) })
    .eq('id', credential.id).eq('secret_value', credential.secret_value).select('id').maybeSingle();
  if (saveError) throw saveError;
  if (!saved) {
    const { data: current, error: currentError } = await admin.from('integration_credentials')
      .select('secret_value').eq('id', credential.id).single();
    if (currentError) throw currentError;
    return JSON.parse(current.secret_value).access_token;
  }
  return latest.access_token;
}

export async function mondayGraphql(token: string, query: string, variables?: Record<string, unknown>) {
  const canRetry = /^\s*(query\b|\{)/.test(query);
  for (let attempt = 0; attempt < (canRetry ? 3 : 1); attempt++) {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2026-07' },
      body: JSON.stringify({ query, variables }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && !result.errors?.length) return result.data;
    if (canRetry && attempt < 2 && [429, 502, 503, 504].includes(response.status)) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 5000) : 500 * 2 ** attempt));
      continue;
    }
    throw new Error(result.errors?.[0]?.message || result.error_message || `Monday API request failed (${response.status})`);
  }
  throw new Error('Monday API request failed');
}
