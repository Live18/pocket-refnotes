-- Fix handle_new_user(): CASE expression returns text by default, but the
-- `role` column is the app_role enum type. Postgres doesn't implicitly cast
-- text to a custom enum, causing every real signup to fail with a 500
-- (SQLSTATE 42804). Adding an explicit cast fixes it.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  existing_count int;
begin
  select count(*) into existing_count from public.profiles;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, (case when existing_count = 0 then 'super_admin' else 'user' end)::public.app_role)
  on conflict (id) do nothing;
  return new;
end $$;