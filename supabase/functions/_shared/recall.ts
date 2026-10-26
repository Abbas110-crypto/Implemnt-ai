const region = Deno.env.get('RECALL_REGION') || 'eu-central-1';
const apiV1 = `https://${region}.recall.ai/api/v1`;
const apiV2 = `https://${region}.recall.ai/api/v2`;

export async function recallRequest(pathOrUrl: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get('RECALL_API_KEY');
  if (!apiKey) throw new Error('RECALL_API_KEY is not configured');
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${apiV2}${pathOrUrl}`;
  if (new URL(url).origin !== new URL(apiV2).origin) throw new Error('Unexpected Recall API URL');
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Token ${apiKey}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
    if (response.ok) return response.status === 204 ? null : response.json();
    if (attempt < 2 && [409, 429, 500, 502, 503, 504, 507].includes(response.status)) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 5000) : 500 * 2 ** attempt));
      continue;
    }
    const detail = await response.text();
    throw new Error(`Recall API ${response.status}: ${detail.slice(0, 400)}`);
  }
  throw new Error('Recall API request failed');
}

function transcriptText(data: unknown) {
  if (typeof data === 'string') return data;
  if (!Array.isArray(data)) return '';
  return data.map((segment: any) => {
    const name = segment.participant?.name || segment.speaker || 'Speaker';
    const words = Array.isArray(segment.words) ? segment.words.map((word: any) => word.text || '').join(' ') : segment.text || '';
    return `${name}: ${words}`;
  }).join('\n');
}

export async function fetchTranscript(transcriptId: string) {
  const metadata = await recallRequest(`${apiV1}/transcript/${encodeURIComponent(transcriptId)}/`);
  if (metadata.status?.code !== 'done' || !metadata.data?.download_url) throw new Error('Transcript is not ready');
  const response = await fetch(metadata.data.download_url);
  if (!response.ok) throw new Error(`Recall transcript download failed (${response.status})`);
  return { text: transcriptText(await response.json()), url: metadata.data.download_url as string };
}

async function saveCall(admin: any, tenantId: string, botId: string, values: Record<string, unknown>) {
  const { data: tracked, error: trackedError } = await admin.from('recall_calendar_events')
    .select('meeting_title,start_time').eq('tenant_id', tenantId).eq('recall_bot_id', botId).limit(1).maybeSingle();
  if (trackedError) throw trackedError;
  if (!tracked) return;
  const { data: existing, error: findError } = await admin.from('call_logs')
    .select('id,recall_status,notes').eq('tenant_id', tenantId).eq('recall_bot_id', botId).maybeSingle();
  if (findError) throw findError;
  const call = {
    title: tracked.meeting_title || 'Meeting', call_date: tracked.start_time,
    ...(existing?.recall_status === 'done' && existing.notes && values.recall_status !== 'done'
      ? { ...values, recall_status: 'done', recall_error: null, notes: existing.notes } : values),
  };
  if (existing) {
    const { error } = await admin.from('call_logs').update(call).eq('id', existing.id).eq('tenant_id', tenantId);
    if (error) throw error;
  } else {
    const { error } = await admin.from('call_logs').insert({ tenant_id: tenantId, client_id: null, recall_bot_id: botId, ...call });
    if (error?.code === '23505') return saveCall(admin, tenantId, botId, values);
    if (error) throw error;
  }
}

export async function saveBotStatus(admin: any, botId: string, status: string, error: string | null, recordingId?: string) {
  const { data: tracked, error: trackedError } = await admin.from('recall_calendar_events')
    .select('tenant_id').eq('recall_bot_id', botId);
  if (trackedError) throw trackedError;
  for (const tenantId of new Set((tracked || []).map((row: any) => row.tenant_id))) {
    await saveCall(admin, String(tenantId), botId, {
      recall_status: status, recall_error: error,
      ...(recordingId ? { recall_recording_id: recordingId } : {}),
    });
  }
}

export async function syncBotTranscript(admin: any, botId: string, transcriptId: string, recordingId?: string) {
  const { data: tracked, error: trackedError } = await admin.from('recall_calendar_events')
    .select('tenant_id').eq('recall_bot_id', botId);
  if (trackedError) throw trackedError;
  if (!tracked?.length) return 0;
  const transcript = await fetchTranscript(transcriptId);
  for (const tenantId of new Set(tracked.map((row: any) => row.tenant_id))) {
    if (transcript.text) {
      const { error: segmentError } = await admin.from('recall_transcript_segments').upsert({
        tenant_id: tenantId, recall_bot_id: botId, recall_transcript_id: transcriptId,
        recall_recording_id: recordingId || null, transcript_text: transcript.text, transcript_url: transcript.url,
      }, { onConflict: 'tenant_id,recall_transcript_id' });
      if (segmentError) throw segmentError;
      const { data: segments, error: listError } = await admin.from('recall_transcript_segments')
        .select('transcript_text').eq('tenant_id', tenantId).eq('recall_bot_id', botId)
        .order('created_date', { ascending: true });
      if (listError) throw listError;
      await saveCall(admin, String(tenantId), botId, {
        notes: (segments || []).map((segment: any) => segment.transcript_text).filter(Boolean).join('\n\n'),
        transcript_url: transcript.url, recall_transcript_id: transcriptId,
        ...(recordingId ? { recall_recording_id: recordingId } : {}),
        recall_status: 'done', recall_error: null,
      });
    } else {
      await saveCall(admin, String(tenantId), botId, {
        recall_status: 'transcript_empty', recall_error: 'Recall returned an empty transcript.',
      });
    }
  }
  return transcript.text ? new Set(tracked.map((row: any) => row.tenant_id)).size : 0;
}

export async function reconcileBotTranscript(admin: any, botId: string, terminal = false) {
  const bot = await recallRequest(`${apiV1}/bot/${encodeURIComponent(botId)}/`);
  // A missed status webhook must not leave a fully recovered transcript pending forever.
  const botFinished = terminal || (bot.status_changes || []).some((change: any) =>
    change.code === 'done' || change.code === 'fatal');
  let lastError: unknown = null;
  let recovered = 0;
  let complete = Array.isArray(bot.recordings) && bot.recordings.length > 0;
  for (const recording of bot.recordings || []) {
    const transcriptId = recording.media_shortcuts?.transcript?.id;
    if (!transcriptId) { complete = false; continue; }
    try {
      const saved = await syncBotTranscript(admin, botId, String(transcriptId), String(recording.id));
      recovered = Math.max(recovered, saved);
      if (!saved) complete = false;
    } catch (error) {
      lastError = error;
      complete = false;
    }
  }
  if (lastError && !recovered) throw lastError;
  if (complete && botFinished) {
    const { error } = await admin.from('recall_calendar_events')
      .update({ transcript_synced_at: new Date().toISOString(), bot_error: null })
      .eq('recall_bot_id', botId);
    if (error) throw error;
  }
  return { recovered, complete: complete && botFinished };
}

function eventTitle(raw: unknown) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return value?.summary || value?.subject || value?.title || 'Calendar meeting';
  } catch {
    return 'Calendar meeting';
  }
}

export function scheduledBotId(event: any) {
  const start = new Date(event.start_time).getTime();
  const matching = (event.bots || []).filter((bot: any) =>
    bot.bot_id && new Date(bot.start_time).getTime() === start);
  return String((matching.find((bot: any) => bot.meeting_url === event.meeting_url)
    || matching[0])?.bot_id || '');
}

export async function syncCalendarEvents(admin: any, calendar: any, filters: Record<string, string>) {
  const params = new URLSearchParams({ calendar_id: calendar.recall_calendar_id, ...filters });
  let url: string | null = `${apiV2}/calendar-events/?${params}`;
  let pages = 0, scheduled = 0;
  const failures: string[] = [];
  while (url && pages++ < 50) {
    const result = await recallRequest(url);
    for (const event of result.results || []) {
      const eventId = String(event.id);
      const record = {
        tenant_id: calendar.tenant_id, calendar_id: calendar.id,
        recall_calendar_id: calendar.recall_calendar_id, recall_event_id: eventId,
        ical_uid: event.ical_uid || null, meeting_url: event.meeting_url || null,
        meeting_title: eventTitle(event.raw), start_time: event.start_time || null,
        end_time: event.end_time || null, is_deleted: Boolean(event.is_deleted),
        source_updated_at: event.updated_at || null,
      };
      const { data: previous, error: previousError } = await admin.from('recall_calendar_events')
        .select('id,recall_bot_id,bot_status,source_updated_at,start_time').eq('tenant_id', calendar.tenant_id)
        .eq('recall_calendar_id', calendar.recall_calendar_id).eq('recall_event_id', eventId).maybeSingle();
      if (previousError) throw previousError;
      const { data: stored, error: storeError } = await admin.from('recall_calendar_events')
        .upsert(record, { onConflict: 'tenant_id,recall_calendar_id,recall_event_id' }).select('id').single();
      if (storeError) throw storeError;
      let reason: string | null = null;
      if (event.is_deleted) reason = 'cancelled';
      else if (!calendar.auto_record) reason = 'auto_record_off';
      else if (!event.meeting_url || !event.start_time || !event.meeting_platform) reason = 'no_meeting_link';
      else if (new Date(event.start_time).getTime() < Date.now() - 5 * 60 * 1000 && !previous?.recall_bot_id) reason = 'past_event';
      if (reason) {
        const { error } = await admin.from('recall_calendar_events')
          .update({ bot_status: reason, bot_error: reason === 'no_meeting_link' ? 'No supported meeting URL was found.' : null })
          .eq('id', stored.id);
        if (error) throw error;
        if (reason === 'auto_record_off' && previous?.recall_bot_id) {
          await recallRequest(`/calendar-events/${encodeURIComponent(eventId)}/bot/`, { method: 'DELETE' });
        }
        continue;
      }
      if (new Date(event.start_time).getTime() < Date.now() - 5 * 60 * 1000) continue;
      if (previous?.recall_bot_id && previous.source_updated_at === event.updated_at
        && !['schedule_error', 'no_meeting_link', 'auto_record_off'].includes(previous.bot_status)) continue;
      try {
        const scheduledEvent = await recallRequest(`/calendar-events/${encodeURIComponent(eventId)}/bot/`, {
          method: 'POST',
          body: JSON.stringify({
            deduplication_key: `${calendar.tenant_id}:${event.ical_uid || eventId}:${event.start_time}`.slice(0, 2000),
            bot_config: {
              bot_name: calendar.bot_name || 'Notetaker',
              metadata: { tenant_id: String(calendar.tenant_id), recall_calendar_id: String(calendar.recall_calendar_id), recall_event_id: eventId },
              recording_config: { transcript: { provider: { recallai_streaming: {} } } },
            },
          }),
        });
        // Recall can return old and new bots for a moved recurring event, in no
        // guaranteed order. Track the bot that matches this occurrence.
        const botId = scheduledBotId(scheduledEvent);
        if (!botId) throw new Error('Recall did not return a bot ID');
        const newOccurrence = String(previous?.recall_bot_id || '') !== String(botId)
          || new Date(previous?.start_time || 0).getTime() !== new Date(event.start_time || 0).getTime();
        const { error } = await admin.from('recall_calendar_events').update({
          recall_bot_id: String(botId), bot_status: 'scheduled', bot_error: null,
          ...(newOccurrence ? { transcript_synced_at: null, transcript_checked_at: null } : {}),
          last_processed: new Date().toISOString(),
        }).eq('id', stored.id);
        if (error) throw error;
        scheduled++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bot scheduling failed';
        const { error: saveError } = await admin.from('recall_calendar_events')
          .update({ bot_status: 'schedule_error', bot_error: message.slice(0, 500) }).eq('id', stored.id);
        if (saveError) throw saveError;
        failures.push(`${eventId}: ${message}`);
      }
    }
    url = result.next || null;
  }
  if (url) throw new Error('Recall calendar pagination limit reached');
  if (failures.length) throw new Error(`Could not schedule ${failures.length} event(s): ${failures.slice(0, 3).join('; ')}`);
  return { pages, scheduled };
}

export async function reconcileCalendar(admin: any, calendar: any) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sync = calendar.status === 'disconnected'
    ? { pages: 0, scheduled: 0 }
    : await syncCalendarEvents(admin, calendar, { start_time__gte: since });
  const { data: events, error } = await admin.from('recall_calendar_events')
    .select('recall_bot_id,start_time,bot_status').eq('tenant_id', calendar.tenant_id)
    .eq('calendar_id', calendar.id).not('recall_bot_id', 'is', null)
    .is('transcript_synced_at', null)
    .gte('start_time', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString())
    .lte('start_time', new Date().toISOString())
    .order('transcript_checked_at', { ascending: true, nullsFirst: true }).limit(10);
  if (error) throw error;
  let transcripts = 0;
  const seen = new Set<string>();
  for (const event of events || []) {
    const botId = String(event.recall_bot_id);
    if (seen.has(botId)) continue;
    seen.add(botId);
    try {
      const result = await reconcileBotTranscript(admin, botId, ['done', 'fatal'].includes(event.bot_status));
      transcripts += result.recovered;
      if (!result.complete && new Date(event.start_time).getTime() < Date.now() - 60 * 60 * 1000) {
        await saveBotStatus(admin, botId, 'transcript_pending', 'Transcript has not arrived. Retrying automatically.');
        const { error: pendingError } = await admin.from('recall_calendar_events')
          .update({ bot_error: 'Transcript incomplete. Retrying automatically.' })
          .eq('tenant_id', calendar.tenant_id).eq('recall_bot_id', botId);
        if (pendingError) throw pendingError;
      }
    }
    catch (error) {
      console.warn(`Recall transcript still unavailable for bot ${botId}:`, error);
      if (new Date(event.start_time).getTime() < Date.now() - 60 * 60 * 1000) {
        await saveBotStatus(admin, botId, 'transcript_pending', 'Transcript retrieval failed. Retrying automatically.');
        const { error: pendingError } = await admin.from('recall_calendar_events')
          .update({ bot_error: 'Transcript retrieval failed. Retrying automatically.' })
          .eq('tenant_id', calendar.tenant_id).eq('recall_bot_id', botId);
        if (pendingError) throw pendingError;
      }
    }
    const { error: checkedError } = await admin.from('recall_calendar_events')
      .update({ transcript_checked_at: new Date().toISOString() })
      .eq('tenant_id', calendar.tenant_id).eq('recall_bot_id', botId);
    if (checkedError) throw checkedError;
  }
  return { ...sync, transcripts };
}
