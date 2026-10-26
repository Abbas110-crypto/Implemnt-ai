import { createAdminClient, isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';
import { reconcileCalendar } from '../_shared/recall.ts';

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  const admin = createAdminClient();
  try {
    const { data: calendars, error } = await admin.from('recall_calendars')
      .select('*').eq('tenant_id', auth.user.id).eq('status', 'connected');
    if (error) throw error;
    let scheduled = 0, updated = 0;
    const failures: string[] = [];
    for (const calendar of calendars || []) {
      try {
        const result = await reconcileCalendar(admin, calendar);
        scheduled += result.scheduled;
        updated += result.transcripts;
        const { error: saveError } = await admin.from('recall_calendars')
          .update({ last_synced: new Date().toISOString(), last_checked: new Date().toISOString(), sync_error: null })
          .eq('id', calendar.id).eq('tenant_id', auth.user.id);
        if (saveError) throw saveError;
      } catch (cause) {
        failures.push(`${calendar.user_email}: ${cause instanceof Error ? cause.message : 'Sync failed'}`);
      }
    }
    if (failures.length) return jsonResponse({ ok: false, scheduled, updated, failures }, 502);
    return jsonResponse({ ok: true, scheduled, updated, calendars: calendars?.length || 0 });
  } catch (error) {
    console.error('Recall manual sync failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Recall sync failed' }, 500);
  }
});
