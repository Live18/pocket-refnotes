-- Captures a policy that was created directly in the live database (Machine A)
-- but was never committed as a migration file. Written from the exact
-- pg_policies definition confirmed live:
--   policyname: super_admin reads activity log
--   cmd:        SELECT
--   qual:       (my_role() = 'super_admin'::app_role)
--
-- Guarded with drop-if-exists so this is safe to run on Machine B (where the
-- policy doesn't exist yet) AND safe to re-run on Machine A (where it already
-- does) without erroring.

do $$
begin
  if exists (
    select 1 from pg_policies
    where tablename = 'activity_log'
      and policyname = 'super_admin reads activity log'
  ) then
    drop policy "super_admin reads activity log" on public.activity_log;
  end if;
end
$$;

create policy "super_admin reads activity log"
  on public.activity_log
  for select
  to authenticated
  using (my_role() = 'super_admin'::app_role);
