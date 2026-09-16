create table public.activity_log_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id),
  date_range_start timestamptz,
  date_range_end timestamptz,
  status text not null default 'pending' check (status in ('pending', 'fulfilled')),
  fulfilled_at timestamptz,
  fulfilled_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.activity_log_requests enable row level security;

create policy "admins submit their own requests"
  on public.activity_log_requests
  for insert
  to authenticated
  with check (requested_by = auth.uid());

create policy "requester or super_admin can view"
  on public.activity_log_requests
  for select
  to authenticated
  using (requested_by = auth.uid() or my_role() = 'super_admin');