alter table public.call_logs add column if not exists recall_transcript_id text;
alter table public.recall_calendar_events add column if not exists source_updated_at timestamptz;
alter table public.recall_calendars add column if not exists last_checked timestamptz;
alter table public.recall_calendars add column if not exists sync_error text;
alter table public.recall_calendars drop constraint if exists recall_calendars_status_check;
alter table public.recall_calendars add constraint recall_calendars_status_check
  check (status in ('connecting', 'connected', 'disconnected', 'error'));

create index if not exists recall_calendar_events_bot_id_idx
  on public.recall_calendar_events (recall_bot_id) where recall_bot_id is not null;
create index if not exists recall_calendar_events_calendar_start_idx
  on public.recall_calendar_events (calendar_id, start_time desc);
create index if not exists recall_calendars_reconcile_idx
  on public.recall_calendars (last_checked) where status in ('connected', 'connecting');

create table if not exists public.hubspot_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references auth.users(id) on delete cascade,
  hub_id bigint not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
alter table public.hubspot_connections enable row level security;
create policy hubspot_connections_select_self on public.hubspot_connections
  for select to authenticated using (tenant_id = auth.uid());
create trigger set_updated_date_before_update before update on public.hubspot_connections
  for each row execute procedure public.set_updated_date();
grant select on public.hubspot_connections to authenticated;
