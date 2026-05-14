-- Journal app schema — run on the self-hosted Supabase at RefTechTool.app.
-- This migration creates orgs, profiles, RBAC, invites, games, entries, and report_jobs.
-- All policies assume Supabase Auth (auth.uid()).

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type public.app_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.entry_status as enum ('draft', 'saved_private', 'saved_sent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_job_status as enum ('queued', 'rendering', 'sent', 'failed');
exception when duplicate_object then null; end $$;

-- ---------- Orgs ----------
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references public.orgs(id) on delete set null,
  display_name text,
  email text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- User roles (separate table; never store role on profiles) ----------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, org_id, role)
);

create index if not exists user_roles_user_idx on public.user_roles(user_id);
create index if not exists user_roles_org_idx on public.user_roles(org_id);

-- ---------- has_role security definer (avoids RLS recursion) ----------
create or replace function public.has_role(_user_id uuid, _org_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and org_id  = _org_id
      and role    = _role
  )
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- ---------- Invites ----------
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'member',
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invites_org_idx on public.invites(org_id);
create index if not exists invites_email_idx on public.invites(email);

-- ---------- Games ----------
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  game_date date,
  opponent text,
  location text,
  created_at timestamptz not null default now()
);

create index if not exists games_org_idx on public.games(org_id);
create index if not exists games_created_by_idx on public.games(created_by);

-- ---------- Entries ----------
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  body jsonb not null default '{}'::jsonb,
  status public.entry_status not null default 'draft',
  recipient_email text,
  saved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_author_idx on public.entries(author_id);
create index if not exists entries_org_idx on public.entries(org_id);
create unique index if not exists entries_one_per_game_per_author on public.entries(game_id, author_id);

-- ---------- Report jobs ----------
create table if not exists public.report_jobs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  status public.report_job_status not null default 'queued',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_jobs_status_idx on public.report_jobs(status);
create index if not exists report_jobs_entry_idx on public.report_jobs(entry_id);

-- ---------- updated_at triggers ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();

drop trigger if exists report_jobs_touch on public.report_jobs;
create trigger report_jobs_touch before update on public.report_jobs
  for each row execute function public.touch_updated_at();

-- ---------- Auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
