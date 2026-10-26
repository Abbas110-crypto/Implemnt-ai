import { createAdminClient, isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';

const TOKEN_URL = 'https://auth.monday.com/oauth_ms/oauth/token';
const API_URL = 'https://api.monday.com/v2';

function accessTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
    return Number.isFinite(Number(payload.exp)) ? Number(payload.exp) * 1000 : null;
  } catch {
    return null;
  }
}

async function mondayQuery(token: string, query: string) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2026-07' },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  if (!response.ok || data.errors?.length) throw new Error(data.errors?.[0]?.message || 'Monday API request failed');
  return data.data;
}

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;

  try {
    const { action, redirect_uri, code, code_verifier } = await req.json();
    const admin = createAdminClient();
    const clientId = Deno.env.get('MONDAY_CLIENT_ID');
    const clientSecret = Deno.env.get('MONDAY_CLIENT_SECRET');
    if (action === 'get_status') {
      const { data: connection, error } = await auth.userClient.from('monday_connections')
        .select('account_name,monday_user_id,monday_user_name').eq('tenant_id', auth.user.id)
        .order('updated_date', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      const { data: credential, error: credentialError } = await admin.from('integration_credentials')
        .select('secret_value').eq('tenant_id', auth.user.id).eq('platform', 'monday').eq('credential_name', 'oauth_tokens').maybeSingle();
      if (credentialError) throw credentialError;
      const scopes = credential?.secret_value ? String(JSON.parse(credential.secret_value).scope || '').split(/[\s,]+/) : [];
      const requiredScopes = ['boards:read', 'boards:write', 'me:read', 'users:read', 'updates:write', 'account:read'];
      return jsonResponse({ connected: Boolean(connection && credential),
        needs_reconnect: Boolean(connection && credential && requiredScopes.some((scope) => !scopes.includes(scope))),
        ...(connection && credential ? connection : {}) });
    }

    if (!clientId || !clientSecret) return jsonResponse({ error: 'Monday OAuth credentials are not configured on the server' }, 503);

    if (action === 'get_auth_url') {
      if (!redirect_uri || !code_verifier) return jsonResponse({ error: 'redirect_uri and PKCE verifier are required' }, 400);
      const verifierBytes = new TextEncoder().encode(code_verifier);
      const digest = await crypto.subtle.digest('SHA-256', verifierBytes);
      const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      const state = crypto.randomUUID();
      const url = new URL('https://auth.monday.com/oauth2/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirect_uri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('scope', 'boards:read boards:write me:read users:read updates:write account:read');
      const appVersionId = Deno.env.get('MONDAY_APP_VERSION_ID');
      if (appVersionId) url.searchParams.set('app_version_id', appVersionId);
      return jsonResponse({ auth_url: url.toString(), state });
    }

    if (action === 'exchange_code') {
      if (!code || !code_verifier || !redirect_uri) return jsonResponse({ error: 'Missing OAuth callback details' }, 400);
      const tokenResponse = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier,
          redirect_uri,
        }),
      });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || tokens.error || 'Monday token exchange failed');

      const profile = await mondayQuery(tokens.access_token, '{ me { id name account { name } } }');
      const mondayUser = profile.me;
      const expiresAt = tokens.expires_in
        ? Date.now() + Number(tokens.expires_in) * 1000
        : accessTokenExpiry(tokens.access_token);
      const { error: credentialError } = await admin.from('integration_credentials').upsert({
        tenant_id: auth.user.id,
        platform: 'monday',
        credential_name: 'oauth_tokens',
        secret_value: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          scope: tokens.scope || '',
        }),
      }, { onConflict: 'tenant_id,platform,credential_name' });
      if (credentialError) throw credentialError;

      const { error: connectionError } = await auth.userClient.from('monday_connections').upsert({
        tenant_id: auth.user.id,
        user_email: auth.user.email,
        account_name: mondayUser.account?.name || '',
        monday_user_id: String(mondayUser.id),
        monday_user_name: mondayUser.name || '',
      }, { onConflict: 'tenant_id,user_email' });
      if (connectionError) throw connectionError;
      const { error: staleError } = await auth.userClient.from('monday_connections')
        .delete().eq('tenant_id', auth.user.id).neq('user_email', auth.user.email);
      if (staleError) throw staleError;
      return jsonResponse({ success: true, account_name: mondayUser.account?.name || '', user_name: mondayUser.name || '' });
    }

    if (action === 'disconnect') {
      const { data: credential } = await admin.from('integration_credentials').select('secret_value')
        .eq('tenant_id', auth.user.id).eq('platform', 'monday').eq('credential_name', 'oauth_tokens').maybeSingle();
      if (credential?.secret_value) {
        try {
          const tokens = JSON.parse(credential.secret_value);
          const token = tokens.refresh_token || tokens.access_token;
          if (token) await fetch('https://auth.monday.com/oauth_ms/oauth/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, client_id: clientId, client_secret: clientSecret, token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token' }),
          });
        } catch (error) {
          console.error('Monday token revocation failed:', error);
        }
      }
      await Promise.all([
        admin.from('integration_credentials').delete().eq('tenant_id', auth.user.id).eq('platform', 'monday'),
        auth.userClient.from('monday_connections').delete().eq('tenant_id', auth.user.id),
      ]);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('Monday OAuth request failed:', error);
    return jsonResponse({ error: error.message || 'Monday OAuth failed' }, 500);
  }
});
