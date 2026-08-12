-- RefNotes 1.0 schema — single flat tenant, 3-tier RBAC (user < admin < super_admin)
-- Adapted from the RefNotes 2.0 multi-tenant draft: same games/entries/report_jobs shape,
-- but org_id removed everywhere, role moved onto profiles directly, and an activity_log
-- table added (super_admin-only for now — the "admin can request access" workflow is a
-- 2.0-era feature and isn't built here, just left room for).
--
-- Review before running. This does not touch Machine B — run only against your local
-- Supabase stack (Studio → SQL editor, or `supabase migration new` + this content).

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type public.app_role as enum ('user', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.entry_status as enum ('draft', 'saved_private', 'saved_sent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_job_status as enum ('queued', 'rendering', 'sent', 'failed');
exception when duplicate_object then null; end $$;

-- ---------- Profiles ----------
-- Role lives directly on the profile (not a separate table) because 1.0 is single-tenant —
-- there's no org to scope multiple roles against. Revisit if/when 2.0 reintroduces orgs.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  is_active boolean not null default true,        -- soft delete: false = deactivated, data kept
  invited_by uuid references public.profiles(id) on delete set null,
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

-- ---------- Role-check helper (security definer avoids RLS recursion) ----------
create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(is_active, false) from public.profiles where id = auth.uid()
$$;

-- ---------- Invites ----------
-- Admins can invite 'user' only; super_admin can invite 'user' or 'admin'.
-- Enforced in the RLS insert policy below, not just app code.
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null default 'user',
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invites_email_idx on public.invites(email);

-- ---------- Games ----------
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  game_date date,
  opponent text,
  location text,
  created_at timestamptz not null default now()
);

create index if not exists games_created_by_idx on public.games(created_by);

-- ---------- Entries (Journal) ----------
-- One entry per game per author. Content itself stays flexible in `body` (jsonb) rather
-- than fixed columns, matching the 2.0 draft's approach — the real field list lives in
-- the UI form, not the schema.
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body jsonb not null default '{}'::jsonb,
  status public.entry_status not null default 'draft',
  recipient_email text,
  saved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_author_idx on public.entries(author_id);
create unique index if not exists entries_one_per_game_per_author on public.entries(game_id, author_id);

-- ---------- Report jobs (async send pipeline) ----------
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

-- ---------- Activity log (stub for 1.0) ----------
-- Table exists now so history starts accumulating from day one. Only super_admin can read
-- it in 1.0 — the "admin can request access" approval workflow is a 2.0 feature, not built
-- here. Rows get written by backend/service-role functions, not directly by client inserts
-- (no insert policy is defined below, so RLS blocks client-side writes by default).
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,             -- e.g. 'invited_user', 'removed_user', 'role_changed', 'impersonation_started'
  target_id uuid references public.profiles(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_actor_idx on public.activity_log(actor_id);
create index if not exists activity_log_created_idx on public.activity_log(created_at);

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
-- First user to sign up becomes super_admin automatically (bootstrap case); everyone after
-- defaults to 'user' and gets promoted manually or via invite.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  existing_count int;
begin
  select count(*) into existing_count from public.profiles;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when existing_count = 0 then 'super_admin' else 'user' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==================================================================
-- Row-Level Security
-- ==================================================================
alter table public.profiles     enable row level security;
alter table public.invites      enable row level security;
alter table public.games        enable row level security;
alter table public.entries      enable row level security;
alter table public.report_jobs  enable row level security;
alter table public.activity_log enable row level security;

-- ---------- profiles ----------
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select to authenticated
  using (public.my_role() in ('admin', 'super_admin'));

drop policy if exists "update own basic info" on public.profiles;
create policy "update own basic info" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can update 'user' profiles only (deactivate, edit) — cannot touch admins/super_admin.
drop policy if exists "admins manage users" on public.profiles;
create policy "admins manage users" on public.profiles
  for update to authenticated
  using (public.my_role() = 'admin' and role = 'user')
  with check (role = 'user');

-- Super admin can update any profile, including promoting to admin.
drop policy if exists "super_admin manages everyone" on public.profiles;
create policy "super_admin manages everyone" on public.profiles
  for update to authenticated
  using (public.my_role() = 'super_admin')
  with check (true);

-- NOTE: these UPDATE policies are a first pass. They stop admins from editing other
-- admins/super_admin, but haven't been tested against real UI flows yet — worth
-- re-checking once the admin page is actually wired up.

-- ---------- invites ----------
drop policy if exists "admins invite users, super_admin invites anyone" on public.invites;
create policy "admins invite users, super_admin invites anyone" on public.invites
  for insert to authenticated
  with check (
    (role = 'user' and public.my_role() in ('admin', 'super_admin'))
    or (role = 'admin' and public.my_role() = 'super_admin')
  );

drop policy if exists "admins read invites" on public.invites;
create policy "admins read invites" on public.invites
  for select to authenticated
  using (public.my_role() in ('admin', 'super_admin'));

-- (invite acceptance happens via a service-role server function — no policy needed)

-- ---------- games ----------
drop policy if exists "authors manage own games" on public.games;
create policy "authors manage own games" on public.games
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "admins read all games" on public.games;
create policy "admins read all games" on public.games
  for select to authenticated
  using (public.my_role() in ('admin', 'super_admin'));

-- ---------- entries ----------
-- Full admin visibility, per your call: admins/super_admin can read every entry.
drop policy if exists "authors manage own entries" on public.entries;
create policy "authors manage own entries" on public.entries
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "admins read all entries" on public.entries;
create policy "admins read all entries" on public.entries
  for select to authenticated
  using (public.my_role() in ('admin', 'super_admin'));

-- NOTE: this grants admins READ access to all entries. Whether "act as user" also means
-- admins can WRITE/edit another user's entry directly (vs. a true session-impersonation
-- flow where the admin briefly becomes that user) is a separate implementation decision —
-- not resolved yet, doesn't block schema, but worth deciding before building "act as."

-- ---------- report_jobs ----------
drop policy if exists "authors read own jobs" on public.report_jobs;
create policy "authors read own jobs" on public.report_jobs
  for select to authenticated
  using (exists (
    select 1 from public.entries e
    where e.id = report_jobs.entry_id and e.author_id = auth.uid()
  ));

drop policy if exists "authors enqueue own jobs" on public.report_jobs;
create policy "authors enqueue own jobs" on public.report_jobs
  for insert to authenticated
  with check (exists (
    select 1 from public.entries e
    where e.id = report_jobs.entry_id and e.author_id = auth.uid()
  ));

-- Worker updates report_jobs via service role (bypasses RLS).

-- ---------- activity_log ----------
drop policy if exists "super_admin reads activity log" on public.activity_log;
create policy "super_admin reads activity log" on public.activity_log
  for select to authenticated
  using (public.my_role() = 'super_admin');

-- No insert/update policy defined: client-side writes are blocked by default under RLS.
-- Log entries are written by backend/service-role functions only.