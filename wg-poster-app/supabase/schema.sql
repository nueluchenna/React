-- WG-Kompass Supabase Schema (Free Tier Compatible)
-- Run this entire script once in: Supabase Dashboard -> SQL Editor -> New Query

create table if not exists public.wgs (
  id bigint generated always as identity primary key,
  name text not null,
  city text not null,
  district text not null default 'Zentrum',
  invite_code text not null unique,
  members text[] not null default '{}',
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.rules (
  id bigint generated always as identity primary key,
  wg_id bigint not null references public.wgs(id) on delete cascade,
  title text not null,
  details text,
  category text not null check (category in ('kitchen', 'bathroom', 'trash', 'living', 'quiet', 'general')),
  frequency text not null check (frequency in ('daily', 'weekly', 'as_needed')),
  priority text not null check (priority in ('high', 'normal')),
  completed boolean not null default false,
  source_file text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rules_wg_id on public.rules(wg_id);
create index if not exists idx_wgs_invite_code on public.wgs(invite_code);

-- Keep updated_at fresh on every edit
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rules_updated_at on public.rules;
create trigger trg_rules_updated_at
before update on public.rules
for each row execute function public.set_updated_at();

-- Enable Row Level Security (RLS)
alter table public.wgs enable row level security;
alter table public.rules enable row level security;

-- MVP Policies (zero-friction invite-link collaboration)
-- Note: Before launching Phase 2 (Shared Expenses), tighten these policies
-- by adding Supabase Auth + a public.wg_members(wg_id, user_id) table.
drop policy if exists "wgs_select_all" on public.wgs;
create policy "wgs_select_all" on public.wgs
  for select using (true);

drop policy if exists "wgs_insert_all" on public.wgs;
create policy "wgs_insert_all" on public.wgs
  for insert with check (true);

drop policy if exists "wgs_update_all" on public.wgs;
create policy "wgs_update_all" on public.wgs
  for update using (true);

drop policy if exists "rules_select_all" on public.rules;
create policy "rules_select_all" on public.rules
  for select using (true);

drop policy if exists "rules_insert_all" on public.rules;
create policy "rules_insert_all" on public.rules
  for insert with check (true);

drop policy if exists "rules_update_all" on public.rules;
create policy "rules_update_all" on public.rules
  for update using (true);

drop policy if exists "rules_delete_all" on public.rules;
create policy "rules_delete_all" on public.rules
  for delete using (true);

-- Enable Realtime so all flatmates see updates live without refreshing
alter publication supabase_realtime add table public.wgs;
alter publication supabase_realtime add table public.rules;
