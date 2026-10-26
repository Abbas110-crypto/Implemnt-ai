import { createAdminClient, isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';
import { reconcileCalendar } from '../_shared/recall.ts';

const recallBase = `https://${Deno.env.get('RECALL_REGION') || 'eu-central-1'}.recall.ai/api/v2`;

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();
  const apiKey = Deno.env.get('RECALL_API_KEY');
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  try {
    if (body.action === 'get_auth_url') {
      if (!clientId || !clientSecret || !apiKey) {
        throw new Error('Google OAuth or Recall credentials are missing from Supabase Edge Function secrets.');
      }
      if (!body.redirect_uri || !body.state) return jsonResponse({ error: 'OAuth redirect and state are required.' }, 400);
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({
        client_id: clientId, redirect_uri: body.redirect_uri, response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/userinfo.email',
        access_type: 'offline', prompt: 'consent', state: body.state,
      }).toString();
      return jsonResponse({ auth_url: url.toString() });
    }
    if (body.action === 'exchange_code') {
      if (!apiKey || !clientId || !clientSecret) throw new Error('Recall or Google OAuth server secrets are missing.');
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: body.code, client_id: clientId, client_secret: clientSecret, redirect_uri: body.redirect_uri, grant_type: 'authorization_code' }),
      });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok || !tokens.refresh_token) return jsonResponse({ error: tokens.error_description || 'Google did not return a refresh token. Reconnect and approve access.' }, 400);
      const grantedScopes = new Set(String(tokens.scope || '').split(/\s+/));
      if (!grantedScopes.has('https://www.googleapis.com/auth/calendar.events.readonly')
        || !grantedScopes.has('https://www.googleapis.com/auth/userinfo.email')) {
        return jsonResponse({ error: 'Google Calendar and email permissions are both required. Reconnect and approve both permissions.' }, 400);
      }
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const profile = await profileResponse.json();
      if (!profileResponse.ok || !profile.email) throw new Error('Could not read the Google account email.');
      const { data: existing, error: existingError } = await admin.from('recall_calendars')
        .select('id,recall_calendar_id,bot_name,auto_record').eq('tenant_id', user.id)
        .ilike('user_email', profile.email).order('created_date', { ascending: false }).limit(1).maybeSingle();
      if (existingError) throw existingError;
      const calendarPayload = JSON.stringify({ oauth_client_id: clientId, oauth_client_secret: clientSecret,
        oauth_refresh_token: tokens.refresh_token, oauth_email: profile.email, platform: 'google_calendar' });
      const recallHeaders = { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' };
      let recallResponse = await fetch(existing
        ? `${recallBase}/calendars/${encodeURIComponent(existing.recall_calendar_id)}/`
        : `${recallBase}/calendars/`, {
        method: existing ? 'PATCH' : 'POST', headers: recallHeaders, body: calendarPayload,
      });
      if (existing && recallResponse.status === 404) {
        recallResponse = await fetch(`${recallBase}/calendars/`, {
          method: 'POST', headers: recallHeaders, body: calendarPayload,
        });
      }
      const calendar = await recallResponse.json();
      if (!recallResponse.ok) throw new Error(JSON.stringify(calendar));
      const { error } = await admin.from('recall_calendars').upsert({
        tenant_id: user.id, recall_calendar_id: calendar.id, user_email: profile.email,
        status: ['connected', 'connecting', 'disconnected'].includes(calendar.status) ? calendar.status : 'error',
        bot_name: existing?.bot_name || 'Notetaker', auto_record: existing?.auto_record ?? true,
        sync_error: null,
      }, { onConflict: 'tenant_id,recall_calendar_id' });
      if (error) throw error;
      if (existing && existing.recall_calendar_id !== calendar.id) {
        // Preserve old event-to-bot mappings for transcripts that arrive after
        // the provider replaced this calendar connection.
        const { error: staleError } = await admin.from('recall_calendars')
          .update({ status: 'disconnected' })
          .eq('id', existing.id).eq('tenant_id', user.id);
        if (staleError) throw staleError;
      }
      return jsonResponse({ success: true, status: calendar.status });
    }
    if (body.action === 'disconnect') {
      if (!apiKey) throw new Error('Recall API key is missing from Supabase Edge Function secrets.');
      const { data: calendar, error } = await admin.from('recall_calendars').select('id,recall_calendar_id').eq('id', body.calendar_entity_id).eq('tenant_id', user.id).single();
      if (error) throw error;
      const response = await fetch(`${recallBase}/calendars/${calendar.recall_calendar_id}/`, { method: 'DELETE', headers: { Authorization: `Token ${apiKey}` } });
      if (!response.ok && response.status !== 404) throw new Error('Recall could not disconnect this calendar.');
      const { error: disconnectError } = await admin.from('recall_calendars')
        .update({ status: 'disconnected', sync_error: null })
        .eq('id', calendar.id).eq('tenant_id', user.id);
      if (disconnectError) throw disconnectError;
      return jsonResponse({ success: true });
    }
    if (body.action === 'update_settings') {
      const { data: calendar, error } = await admin.from('recall_calendars')
        .update({ bot_name: String(body.bot_name || 'Notetaker').slice(0, 100), auto_record: Boolean(body.auto_record) })
        .eq('id', body.calendar_entity_id).eq('tenant_id', user.id).select('*').single();
      if (error) throw error;
      if (calendar.status === 'connected') await reconcileCalendar(admin, calendar);
      return jsonResponse({ success: true });
    }
    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Calendar integration failed' }, 500);
  }
});
