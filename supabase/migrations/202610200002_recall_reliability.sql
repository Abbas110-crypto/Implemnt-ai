alter table public.call_logs add column if not exists recall_bot_id text;
alter table public.call_logs add column if not exists recall_recording_id text;
alter table public.call_logs add column if not exists recall_status text;
alter table public.call_logs add column if not exists recall_error text;
create unique index if not exists call_logs_tenant_recall_bot_idx
  on public.call_logs (tenant_id, recall_bot_id) where recall_bot_id is not null;

create table if not exists public.recall_calendar_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id) on delete cascade,
  calendar_id uuid not null references public.recall_calendars(id) on delete cascade,
  recall_calendar_id text not null,
  recall_event_id text not null,
  ical_uid text,
  meeting_url text,
  meeting_title text,
  start_time timestamptz,
  end_time timestamptz,
  is_deleted boolean not null default false,
  recall_bot_id text,
  bot_status text,
  bot_error text,
  last_processed timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (tenant_id, recall_calendar_id, recall_event_id)
);

alter table public.recall_calendar_events enable row level security;
create policy recall_events_select_self on public.recall_calendar_events
  for select to authenticated using (tenant_id = auth.uid());
create policy recall_events_insert_self on public.recall_calendar_events
  for insert to authenticated with check (tenant_id = auth.uid());
create policy recall_events_update_self on public.recall_calendar_events
  for update to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy recall_events_delete_self on public.recall_calendar_events
  for delete to authenticated using (tenant_id = auth.uid());
create trigger set_updated_date_before_update before update on public.recall_calendar_events
  for each row execute procedure public.set_updated_date();

create table if not exists public.recall_webhook_receipts (
  webhook_id text primary key,
  received_at timestamptz not null default now(),
  event_type text not null
);
alter table public.recall_webhook_receipts enable row level security;
