-- Track transcript recovery independently from bot scheduling so reconciliation
-- can fairly retry every unfinished meeting instead of scanning the newest 100.
alter table public.recall_calendar_events
  add column if not exists transcript_synced_at timestamptz,
  add column if not exists transcript_checked_at timestamptz;

update public.recall_calendar_events event
set transcript_synced_at = coalesce(call.updated_date, now())
from public.call_logs call
where event.tenant_id = call.tenant_id
  and event.recall_bot_id = call.recall_bot_id
  and event.recall_bot_id is not null
  and nullif(btrim(call.notes), '') is not null
  and event.transcript_synced_at is null;

create index if not exists recall_events_pending_transcript_idx
  on public.recall_calendar_events (calendar_id, transcript_checked_at, start_time)
  where recall_bot_id is not null and transcript_synced_at is null;
