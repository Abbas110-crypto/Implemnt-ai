-- Keep each Recall recording transcript independently so webhook retries and
-- multi-recording meetings cannot overwrite earlier transcript text.
create table if not exists public.recall_transcript_segments (
  tenant_id uuid not null references auth.users(id) on delete cascade,
  recall_bot_id text not null,
  recall_transcript_id text not null,
  recall_recording_id text,
  transcript_text text not null,
  transcript_url text,
  created_date timestamptz not null default now(),
  primary key (tenant_id, recall_transcript_id)
);

alter table public.recall_transcript_segments enable row level security;
create index if not exists recall_transcript_segments_bot_idx
  on public.recall_transcript_segments (tenant_id, recall_bot_id, created_date);

insert into public.recall_transcript_segments
  (tenant_id, recall_bot_id, recall_transcript_id, recall_recording_id, transcript_text, transcript_url, created_date)
select tenant_id, recall_bot_id, recall_transcript_id, recall_recording_id, notes, transcript_url, created_date
from public.call_logs
where recall_bot_id is not null and recall_transcript_id is not null
  and nullif(btrim(notes), '') is not null
on conflict (tenant_id, recall_transcript_id) do nothing;

-- Recheck recent bots after introducing segment storage. Existing call notes
-- remain intact until a complete transcript is recovered and combined.
update public.recall_calendar_events
set transcript_synced_at = null, transcript_checked_at = null
where recall_bot_id is not null
  and start_time >= now() - interval '28 days'
  and start_time <= now();
