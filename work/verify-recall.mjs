import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.Deno = { env: { get: (name) => name === 'RECALL_REGION' ? 'eu-central-1' : 'test-key' } };
const { reconcileBotTranscript, scheduledBotId } = await import('../supabase/functions/_shared/recall.ts');

function response(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function fakeAdmin() {
  const writes = { calls: [], events: [], segments: [] };
  const from = (table) => {
    let columns = '';
    let values = null;
    const query = {
      select(value) { columns = value; return this; },
      eq() { return this; },
      limit() { return this; },
      order() { return this; },
      update(value) { values = value; return this; },
      insert(value) { writes.calls.push(value); return Promise.resolve({ error: null }); },
      upsert(value) {
        const index = writes.segments.findIndex((item) => item.recall_transcript_id === value.recall_transcript_id);
        if (index >= 0) writes.segments[index] = value;
        else writes.segments.push(value);
        return Promise.resolve({ error: null });
      },
      maybeSingle() {
        if (table === 'recall_calendar_events') return Promise.resolve({ data: { meeting_title: 'Test meeting', start_time: '2026-10-26T10:00:00Z' }, error: null });
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve, reject) {
        if (table === 'recall_calendar_events' && columns === 'tenant_id') {
          return Promise.resolve({ data: [{ tenant_id: 'tenant-1' }], error: null }).then(resolve, reject);
        }
        if (table === 'recall_transcript_segments' && columns === 'transcript_text') {
          return Promise.resolve({ data: writes.segments, error: null }).then(resolve, reject);
        }
        if (table === 'recall_calendar_events' && values) writes.events.push(values);
        return Promise.resolve({ error: null }).then(resolve, reject);
      },
    };
    return query;
  };
  return { from, writes };
}

test('selects the matching occurrence when Recall returns old and new bots out of order', () => {
  assert.equal(scheduledBotId({
    start_time: '2026-10-27T10:00:00Z', meeting_url: 'https://meet.example/new',
    bots: [
      { bot_id: 'old', start_time: '2026-10-20T10:00:00Z', meeting_url: 'https://meet.example/old' },
      { bot_id: 'new', start_time: '2026-10-27T10:00:00+00:00', meeting_url: 'https://meet.example/new' },
    ],
  }), 'new');
});

test('recovers a later recording when the first transcript is not ready', async () => {
  const originalFetch = globalThis.fetch;
  const admin = fakeAdmin();
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/bot/bot-1/')) return response({ recordings: [
      { id: 'recording-1', media_shortcuts: { transcript: { id: 'transcript-1' } } },
      { id: 'recording-2', media_shortcuts: { transcript: { id: 'transcript-2' } } },
    ] });
    if (url.includes('/transcript/transcript-1/')) return response({ status: { code: 'processing' } });
    if (url.includes('/transcript/transcript-2/')) return response({ status: { code: 'done' }, data: { download_url: 'https://eu-central-1.recall.ai/download/test' } });
    if (url.includes('/download/test')) return response([{ participant: { name: 'Customer' }, words: [{ text: 'The' }, { text: 'meeting' }, { text: 'worked' }] }]);
    throw new Error(`Unexpected test request: ${url}`);
  };
  try {
    assert.deepEqual(await reconcileBotTranscript(admin, 'bot-1', true), { recovered: 1, complete: false });
    assert.equal(admin.writes.calls[0].notes, 'Customer: The meeting worked');
    assert.equal(admin.writes.calls[0].recall_transcript_id, 'transcript-2');
    assert.equal(admin.writes.events.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('combines every recording and marks a finished bot complete', async () => {
  const originalFetch = globalThis.fetch;
  const admin = fakeAdmin();
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/bot/bot-2/')) return response({ status_changes: [{ code: 'done' }], recordings: [
      { id: 'recording-a', media_shortcuts: { transcript: { id: 'transcript-a' } } },
      { id: 'recording-b', media_shortcuts: { transcript: { id: 'transcript-b' } } },
    ] });
    if (url.includes('/transcript/transcript-a/')) return response({ status: { code: 'done' }, data: { download_url: 'https://eu-central-1.recall.ai/download/a' } });
    if (url.includes('/transcript/transcript-b/')) return response({ status: { code: 'done' }, data: { download_url: 'https://eu-central-1.recall.ai/download/b' } });
    if (url.includes('/download/a')) return response([{ participant: { name: 'Host' }, words: [{ text: 'First' }, { text: 'part' }] }]);
    if (url.includes('/download/b')) return response([{ participant: { name: 'Guest' }, words: [{ text: 'Second' }, { text: 'part' }] }]);
    throw new Error(`Unexpected test request: ${url}`);
  };
  try {
    assert.deepEqual(await reconcileBotTranscript(admin, 'bot-2'), { recovered: 1, complete: true });
    assert.equal(admin.writes.segments.length, 2);
    assert.equal(admin.writes.calls.at(-1).notes, 'Host: First part\n\nGuest: Second part');
    assert.ok(admin.writes.events[0].transcript_synced_at);
    assert.deepEqual(await reconcileBotTranscript(admin, 'bot-2'), { recovered: 1, complete: true });
    assert.equal(admin.writes.segments.length, 2);
    assert.equal(admin.writes.calls.at(-1).notes, 'Host: First part\n\nGuest: Second part');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
