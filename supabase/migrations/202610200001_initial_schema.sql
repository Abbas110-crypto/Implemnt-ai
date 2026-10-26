create extension if not exists pgcrypto;

create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

create or replace function public.set_current_tenant()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.tenant_id = auth.uid();
  elsif new.tenant_id is null then
    raise exception 'Authentication is required';
  end if;
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  onboarding_tour_completed boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_name text not null,
  contact_name text not null,
  contact_email text,
  logo_url text,
  onboarding_stage text not null default 'kickoff' check (onboarding_stage in ('kickoff','configuration','integration','training','go_live','completed')),
  health_score numeric,
  start_date date,
  target_go_live date,
  arr numeric,
  project_owner text,
  csm_owner text,
  team_members text[] not null default '{}',
  template_id uuid,
  portal_access_token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  notes text,
  monday_contact_id text,
  monday_contact_name text,
  monday_contact_email text,
  monday_account_name text,
  hubspot_contact_id text,
  hubspot_deal_id text,
  salesforce_contact_id text,
  churnzero_account_id text,
  churn_risk_score numeric,
  churn_risk_level text check (churn_risk_level in ('low','medium','high','critical')),
  last_hubspot_sync timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.project_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  stage_order text[] not null default '{}',
  default_milestones jsonb not null default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.clients drop constraint if exists clients_template_id_fkey;
alter table public.clients add constraint clients_template_id_fkey
  foreign key (template_id) references public.project_templates(id) on delete set null;

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  stage text not null,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed','blocked')),
  due_date date,
  completed_date date,
  owner text,
  sort_order numeric,
  auto_updated boolean not null default false,
  update_source_call_id uuid,
  depends_on uuid[] not null default '{}',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  call_date timestamptz,
  duration_minutes numeric,
  attendees text,
  notes text,
  transcript_url text,
  summary text,
  sentiment text check (sentiment in ('positive','neutral','concerned','negative')),
  action_items jsonb not null default '[]'::jsonb,
  milestone_updates jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  monday_item_id text,
  monday_board_id text,
  monday_account_slug text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.gong_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gong_call_id text not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  call_date timestamptz,
  duration_minutes numeric,
  transcript text,
  participants text,
  summary text,
  extracted_milestones jsonb not null default '[]'::jsonb,
  structured_notes text,
  crm_updates jsonb not null default '[]'::jsonb,
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected')),
  approved_by text,
  approved_date timestamptz,
  synced_to_crm boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (tenant_id, gong_call_id)
);

alter table public.milestones drop constraint if exists milestones_update_source_call_id_fkey;
alter table public.milestones add constraint milestones_update_source_call_id_fkey
  foreign key (update_source_call_id) references public.call_logs(id) on delete set null;

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  client_id uuid not null references public.clients(id) on delete cascade,
  call_id uuid,
  call_type text check (call_type in ('gong','call_log')),
  triggered_by_keywords text[] not null default '{}',
  risk_category text check (risk_category in ('timeline','communication','technical','budget','satisfaction','status','other')),
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','sent_to_monday')),
  monday_item_id text,
  monday_board_id text,
  approved_by text,
  context_snippet text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.risk_keywords (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  keyword text not null,
  category text not null default 'other' check (category in ('timeline','communication','technical','budget','satisfaction','status','other')),
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  active boolean not null default true,
  description text,
  monday_status_value text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (tenant_id, keyword)
);

create table if not exists public.milestone_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  author_name text,
  author_email text,
  content text not null,
  is_internal boolean not null default false,
  mentions jsonb not null default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.monday_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_email text not null,
  account_name text,
  monday_user_id text,
  monday_user_name text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (tenant_id, user_email)
);

create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform text not null,
  credential_name text not null,
  secret_value text not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (tenant_id, platform, credential_name)
);

create table if not exists public.recall_calendars (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recall_calendar_id text not null,
  user_email text not null,
  platform text not null default 'google_calendar' check (platform in ('google_calendar','microsoft_outlook')),
  status text not null default 'connected' check (status in ('connected','disconnected','error')),
  bot_name text not null default 'Notetaker',
  auto_record boolean not null default true,
  last_synced timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (tenant_id, recall_calendar_id)
);

create table if not exists public.crm_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  platform text not null default 'custom',
  webhook_url text not null,
  auth_header_name text,
  auth_header_value text,
  event_types text[] not null default '{}',
  enabled boolean not null default true,
  last_sync timestamptz,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.executive_summary_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  recipients text[] not null default '{}',
  frequency text not null default 'weekly' check (frequency in ('daily','weekly','monthly')),
  day_of_week text,
  day_of_month integer,
  send_time text,
  data_points text[] not null default '{}',
  enabled boolean not null default true,
  last_sent timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clients','project_templates','milestones','call_logs','gong_calls','action_items',
    'risk_keywords','milestone_comments','monday_connections',
    'recall_calendars','crm_integrations','executive_summary_configs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists tenant_select on public.%I', table_name);
    execute format('drop policy if exists tenant_insert on public.%I', table_name);
    execute format('drop policy if exists tenant_update on public.%I', table_name);
    execute format('drop policy if exists tenant_delete on public.%I', table_name);
    execute format('create policy tenant_select on public.%I for select to authenticated using (tenant_id = auth.uid())', table_name);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (tenant_id = auth.uid())', table_name);
    execute format('create policy tenant_update on public.%I for update to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid())', table_name);
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (tenant_id = auth.uid())', table_name);
    execute format('drop trigger if exists set_tenant_before_insert on public.%I', table_name);
    execute format('create trigger set_tenant_before_insert before insert on public.%I for each row execute procedure public.set_current_tenant()', table_name);
    execute format('drop trigger if exists set_updated_date_before_update on public.%I', table_name);
    execute format('create trigger set_updated_date_before_update before update on public.%I for each row execute procedure public.set_updated_date()', table_name);
  end loop;
end;
$$;

-- Integration tokens are only accessed by trusted Edge Functions using the service role.
alter table public.integration_credentials enable row level security;

alter table public.profiles enable row level security;
drop policy if exists profile_select_self on public.profiles;
drop policy if exists profile_insert_self on public.profiles;
drop policy if exists profile_update_self on public.profiles;
create policy profile_select_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profile_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profile_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop trigger if exists set_updated_date_before_update on public.profiles;
create trigger set_updated_date_before_update before update on public.profiles for each row execute procedure public.set_updated_date();

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, onboarding_tour_completed) on public.profiles to authenticated;
