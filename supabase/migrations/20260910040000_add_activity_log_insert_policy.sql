create policy "users log their own activity"
  on public.activity_log
  for insert
  to authenticated
  with check (actor_id = auth.uid());