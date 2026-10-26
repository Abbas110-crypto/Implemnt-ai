import { createAdminClient, isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';
import { recallRequest, reconcileCalendar } from '../_shared/recall.ts';

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  const admin = createAdminClient();
  try {
    const { data: calendars, error } = await admin.from('recall_calendars')
      .select('*').eq('tenant_id', auth.user.id).in('status', ['connecting', 'connected']);
    if (error) throw error;
    let scheduled = 0, updated = 0, connecting = 0;
    const failures: string[] = [];
    for (const calendar of calendars || []) {
      try {
        if (calendar.status === 'connecting') {
          const current = await recallRequest(`/calendars/${encodeURIComponent(calendar.recall_calendar_id)}/`);
          const status = ['connected', 'connecting', 'disconnected'].includes(current.status) ? current.status : 'error';
          const { error: statusError } = await admin.from('recall_calendars')
            .update({ status, last_checked: new Date().toISOString(),
              sync_error: status === 'disconnected' ? 'Google Calendar access was lost. Reconnect this calendar.' : null })
            .eq('id', calendar.id).eq('tenant_id', auth.user.id);
          if (statusError) throw statusError;
          if (status !== 'connected') {
            if (status === 'connecting') connecting++;
            else failures.push(`${calendar.user_email}: Calendar is ${status}. Reconnect it.`);
            continue;
          }
        }
        const result = await reconcileCalendar(admin, calendar);
        scheduled += result.scheduled;
        updated += result.transcripts;
        const { error: saveError } = await admin.from('recall_calendars')
          .update({ last_synced: new Date().toISOString(), last_checked: new Date().toISOString(), sync_error: null })
          .eq('id', calendar.id).eq('tenant_id', auth.user.id);
        if (saveError) throw saveError;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Sync failed';
        failures.push(`${calendar.user_email}: ${message}`);
        await admin.from('recall_calendars').update({ last_checked: new Date().toISOString(), sync_error: message.slice(0, 500) })
          .eq('id', calendar.id).eq('tenant_id', auth.user.id);
      }
    }
    if (failures.length) return jsonResponse({ ok: false, scheduled, updated, failures,
      error: failures.slice(0, 3).join('; ') }, 502);
    return jsonResponse({ ok: true, scheduled, updated, calendars: calendars?.length || 0, connecting });
  } catch (error) {
    console.error('Recall manual sync failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Recall sync failed' }, 500);
  }
});
