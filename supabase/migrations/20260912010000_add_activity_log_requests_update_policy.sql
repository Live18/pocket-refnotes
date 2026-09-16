-- The activity_log_requests table only had INSERT and SELECT policies —
-- no UPDATE policy existed, which silently blocked fulfillActivityLogRequest's
-- attempt to set status/fulfilled_at/fulfilled_by (RLS filtered the update
-- down to zero rows with no error, matching the failure shape already seen
-- and worked around elsewhere in revokeInvite).

create policy "super_admin fulfills requests"
  on public.activity_log_requests
  for update
  to authenticated
  using (my_role() = 'super_admin'::app_role)
  with check (my_role() = 'super_admin'::app_role);
