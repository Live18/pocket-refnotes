create policy "admins revoke invites, super_admin revokes any"
on "public"."invites"
for delete
to authenticated
using (
  ((role = 'user'::app_role) AND (my_role() = ANY (ARRAY['admin'::app_role, 'super_admin'::app_role])))
  OR (my_role() = 'super_admin'::app_role)
);