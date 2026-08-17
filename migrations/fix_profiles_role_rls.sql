-- Fix self-promotion hole in "update own basic info" policy.
-- Previously only checked row ownership (id = auth.uid()), not which columns
-- changed — any authenticated user could set their own role to anything,
-- including super_admin, bypassing changeRole() entirely.
-- Now requires role to stay unchanged on self-updates; role changes must
-- go through the admin/super_admin management policies instead.

drop policy if exists "update own basic info" on public.profiles;
create policy "update own basic info" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role());
