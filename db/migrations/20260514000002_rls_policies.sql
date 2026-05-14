-- Row-Level Security policies for the Journal schema.

alter table public.orgs           enable row level security;
alter table public.profiles       enable row level security;
alter table public.user_roles     enable row level security;
alter table public.invites        enable row level security;
alter table public.games          enable row level security;
alter table public.entries        enable row level security;
alter table public.report_jobs    enable row level security;

-- ---------- orgs ----------
drop policy if exists "members read own org" on public.orgs;
create policy "members read own org" on public.orgs
  for select to authenticated
  using (id = public.current_org_id());

drop policy if exists "admins update own org" on public.orgs;
create policy "admins update own org" on public.orgs
  for update to authenticated
  using (public.has_role(auth.uid(), id, 'admin'))
  with check (public.has_role(auth.uid(), id, 'admin'));

-- ---------- profiles ----------
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "admins read org profiles" on public.profiles;
create policy "admins read org profiles" on public.profiles
  for select to authenticated
  using (public.has_role(auth.uid(), org_id, 'admin'));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- user_roles ----------
drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), org_id, 'admin'));

drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), org_id, 'admin'))
  with check (public.has_role(auth.uid(), org_id, 'admin'));

-- ---------- invites ----------
drop policy if exists "admins manage invites" on public.invites;
create policy "admins manage invites" on public.invites
  for all to authenticated
  using (public.has_role(auth.uid(), org_id, 'admin'))
  with check (public.has_role(auth.uid(), org_id, 'admin'));

-- (invite acceptance happens via service-role server function — no policy needed)

-- ---------- games ----------
drop policy if exists "members manage own games" on public.games;
create policy "members manage own games" on public.games
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and org_id = public.current_org_id());

-- ---------- entries (body never visible to admins) ----------
drop policy if exists "authors manage own entries" on public.entries;
create policy "authors manage own entries" on public.entries
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and org_id = public.current_org_id());

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
