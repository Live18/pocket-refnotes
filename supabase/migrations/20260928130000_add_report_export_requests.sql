-- Bulk report export requests. Same workflow as activity_log_requests: an admin (or super
-- admin) requests a CSV of delivered reports for a range of SENT dates; a super admin
-- fulfills it, which downloads the CSV in the super admin's browser and logs the export
-- to activity_log.
--
-- sent_from / sent_to are whole calendar days in Pacific time, both inclusive; either may be
-- null for an open-ended range. The server converts them to timestamps when fulfilling.

create table public.report_export_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id),
  sent_from date,
  sent_to date,
  status text not null default 'pending' check (status in ('pending', 'fulfilled')),
  report_count integer,
  fulfilled_at timestamptz,
  fulfilled_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint report_export_requests_range_order check (sent_from is null or sent_to is null or sent_from <= sent_to)
);

create index report_export_requests_requested_by_idx on public.report_export_requests (requested_by);

alter table public.report_export_requests enable row level security;

create policy "admins submit their own export requests"
  on public.report_export_requests
  for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and public.my_role() in ('admin', 'super_admin')
  );

create policy "requester or super_admin can view export requests"
  on public.report_export_requests
  for select
  to authenticated
  using (requested_by = auth.uid() or public.my_role() = 'super_admin');

create policy "super_admin fulfills export requests"
  on public.report_export_requests
  for update
  to authenticated
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');
