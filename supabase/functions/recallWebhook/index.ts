import { createAdminClient, jsonResponse } from '../_shared/http.ts';
import { recallRequest, saveBotStatus, syncBotTranscript, syncCalendarEvents } from '../_shared/recall.ts';

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

async function verifyRecallRequest(req: Request, rawBody: string, secret: string) {
  const id = req.headers.get('webhook-id') || req.headers.get('svix-id');
  const timestamp = req.headers.get('webhook-timestamp') || req.headers.get('svix-timestamp');
  const signatures = req.headers.get('webhook-signature') || req.headers.get('svix-signature');
  if (!secret.startsWith('whsec_') || !id || !timestamp || !signatures) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 5 * 60) return false;
  const key = Uint8Array.from(atob(secret.slice(6)), (char) => char.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`)));
  return signatures.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    try { return constantTimeEqual(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)), digest); }
    catch { return false; }
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const rawBody = await req.text();
  try {
    const secret = Deno.env.get('RECALL_WORKSPACE_VERIFICATION_SECRET') || '';
    if (!await verifyRecallRequest(req, rawBody, secret)) return jsonResponse({ error: 'Invalid Recall signature' }, 401);
    const event = JSON.parse(rawBody);
    const webhookId = req.headers.get('webhook-id') || req.headers.get('svix-id')!;
    const admin = createAdminClient();
    const { data: receipt, error: receiptLookupError } = await admin.from('recall_webhook_receipts')
      .select('webhook_id').eq('webhook_id', webhookId).maybeSingle();
    if (receiptLookupError) throw receiptLookupError;
    if (receipt) return jsonResponse({ received: true, duplicate: true });

    const eventType = String(event.event || '');
    const data = event.data || {};
    if (eventType === 'calendar.sync_events' && data.calendar_id && data.last_updated_ts) {
      const { data: calendars, error } = await admin.from('recall_calendars').select('*')
        .eq('recall_calendar_id', String(data.calendar_id));
      if (error) throw error;
      for (const calendar of calendars || []) {
        if (calendar.status === 'disconnected') continue;
        await syncCalendarEvents(admin, calendar, { updated_at__gte: String(data.last_updated_ts) });
        const { error: updateError } = await admin.from('recall_calendars')
          .update({ status: 'connected', last_synced: new Date().toISOString(), sync_error: null }).eq('id', calendar.id);
        if (updateError) throw updateError;
      }
    } else if (eventType === 'calendar.update' && data.calendar_id) {
      let nextStatus = 'disconnected';
      try {
        const state = await recallRequest(`/calendars/${encodeURIComponent(data.calendar_id)}/`);
        nextStatus = ['connected', 'connecting', 'disconnected'].includes(state.status) ? state.status : 'error';
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith('Recall API 404:')) throw error;
      }
      const { error } = await admin.from('recall_calendars')
        .update({ status: nextStatus })
        .eq('recall_calendar_id', String(data.calendar_id));
      if (error) throw error;
    } else if (eventType === 'transcript.done' && data.bot?.id && data.transcript?.id) {
      const recovered = await syncBotTranscript(admin, String(data.bot.id), String(data.transcript.id), data.recording?.id && String(data.recording.id));
      if (!recovered) {
        const { error } = await admin.from('recall_calendar_events')
          .update({ transcript_synced_at: null }).eq('recall_bot_id', String(data.bot.id));
        if (error) throw error;
      }
    } else if (eventType === 'transcript.failed' && data.bot?.id) {
      await saveBotStatus(admin, String(data.bot.id), 'transcript_failed',
        String(data.data?.sub_code || 'Transcript processing failed'), data.recording?.id && String(data.recording.id));
      const { error } = await admin.from('recall_calendar_events')
        .update({ transcript_synced_at: null }).eq('recall_bot_id', String(data.bot.id));
      if (error) throw error;
    } else if ((eventType === 'recording.done' || eventType === 'recording.failed') && data.bot?.id) {
      await saveBotStatus(admin, String(data.bot.id), eventType.replace('.', '_'),
        eventType.endsWith('failed') ? String(data.data?.sub_code || 'Recording failed') : null,
        data.recording?.id && String(data.recording.id));
      const { error } = await admin.from('recall_calendar_events')
        .update({ transcript_synced_at: null }).eq('recall_bot_id', String(data.bot.id));
      if (error) throw error;
    } else if (eventType.startsWith('bot.') && data.bot?.id) {
      const botId = String(data.bot.id);
      const status = eventType.slice(4);
      const failure = status === 'fatal'
        ? String(data.data?.sub_code || data.data?.code || 'Bot could not join the meeting') : null;
      const { error } = await admin.from('recall_calendar_events')
        .update({ bot_status: status, bot_error: failure }).eq('recall_bot_id', botId);
      if (error) throw error;
      if (status === 'done' || failure) await saveBotStatus(admin, botId, `bot_${status}`, failure);
    }
    const { error: receiptError } = await admin.from('recall_webhook_receipts')
      .insert({ webhook_id: webhookId, event_type: eventType });
    if (receiptError?.code !== '23505' && receiptError) throw receiptError;
    return jsonResponse({ received: true });
  } catch (error) {
    console.error('Recall webhook processing failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Webhook processing failed' }, 500);
  }
});
