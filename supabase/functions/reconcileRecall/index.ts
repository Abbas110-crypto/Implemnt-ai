import { createAdminClient, jsonResponse } from '../_shared/http.ts';
import { recallRequest, reconcileCalendar } from '../_shared/recall.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const expected = Deno.env.get('RECALL_RECONCILE_SECRET');
  if (!expected || req.headers.get('x-reconcile-secret') !== expected) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  const admin = createAdminClient();
  try {
    const { data: calendars, error } = await admin.from('recall_calendars').select('*')
      .in('status', ['connected', 'connecting']).order('last_checked', { ascending: true, nullsFirst: true }).limit(10);
    if (error) throw error;
    const results: { calendar_id: string; scheduled?: number; transcripts?: number; error?: string }[] = [];
    for (const calendar of calendars || []) {
      try {
        if (calendar.status === 'connecting') {
          const current = await recallRequest(`/calendars/${encodeURIComponent(calendar.recall_calendar_id)}/`);
          const nextStatus = current.status === 'connected' ? 'connected'
            : current.status === 'disconnected' ? 'disconnected' : 'connecting';
          const { error: statusError } = await admin.from('recall_calendars')
            .update({ status: nextStatus, last_checked: new Date().toISOString() }).eq('id', calendar.id);
          if (statusError) throw statusError;
          if (nextStatus !== 'connected') {
            results.push({ calendar_id: calendar.id, error: `Calendar is ${nextStatus}` });
            continue;
          }
        }
        const result = await reconcileCalendar(admin, calendar);
        const { error: updateError } = await admin.from('recall_calendars').update({
          last_checked: new Date().toISOString(), last_synced: new Date().toISOString(), sync_error: null,
        }).eq('id', calendar.id);
        if (updateError) throw updateError;
        results.push({ calendar_id: calendar.id, scheduled: result.scheduled, transcripts: result.transcripts });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Reconciliation failed';
        const { error: updateError } = await admin.from('recall_calendars')
          .update({ last_checked: new Date().toISOString(), sync_error: message.slice(0, 500) })
          .eq('id', calendar.id);
        if (updateError) throw updateError;
        results.push({ calendar_id: calendar.id, error: message });
      }
    }
    // A disconnected calendar must not schedule new bots, but its existing
    // event mappings are still needed when a transcript is delivered late.
    const { data: pendingEvents, error: pendingError } = await admin.from('recall_calendar_events')
      .select('calendar_id,recall_calendars!inner(status)')
      .eq('recall_calendars.status', 'disconnected')
      .not('recall_bot_id', 'is', null).is('transcript_synced_at', null)
      .gte('start_time', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString())
      .lte('start_time', new Date().toISOString())
      .order('transcript_checked_at', { ascending: true, nullsFirst: true }).limit(10);
    if (pendingError) throw pendingError;
    for (const calendarId of new Set((pendingEvents || []).map((event: any) => event.calendar_id))) {
      const { data: calendar, error: calendarError } = await admin.from('recall_calendars')
        .select('*').eq('id', calendarId).single();
      if (calendarError) throw calendarError;
      try {
        const result = await reconcileCalendar(admin, calendar);
        const { error: updateError } = await admin.from('recall_calendars')
          .update({ last_checked: new Date().toISOString(), sync_error: null }).eq('id', calendar.id);
        if (updateError) throw updateError;
        results.push({ calendar_id: calendar.id, scheduled: 0, transcripts: result.transcripts });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Transcript recovery failed';
        await admin.from('recall_calendars')
          .update({ last_checked: new Date().toISOString(), sync_error: message.slice(0, 500) }).eq('id', calendar.id);
        results.push({ calendar_id: calendar.id, error: message });
      }
    }
    return jsonResponse({ processed: results.length, failures: results.filter((item) => item.error).length, results });
  } catch (error) {
    console.error('Recall reconciliation failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Reconciliation failed' }, 500);
  }
});
