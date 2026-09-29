-- Narrow admin/super_admin read access to other users' reports: only reports whose email was
-- actually delivered (status saved_sent AND sent_at stamped). Drafts, saved-private reports,
-- send_failed reports, and sent-but-still-queued reports are visible to their author only.
-- Games follow the same rule: an admin can read another user's game only if it has a
-- delivered report. Authors keep full access to their own rows via the unchanged
-- "authors manage own games/entries" policies.

drop policy if exists "admins read all entries" on public.entries;
drop policy if exists "admins read delivered entries" on public.entries;
create policy "admins read delivered entries" on public.entries
  for select to authenticated
  using (
    public.my_role() in ('admin', 'super_admin')
    and status = 'saved_sent'
    and sent_at is not null
  );

drop policy if exists "admins read all games" on public.games;
drop policy if exists "admins read games with delivered reports" on public.games;
create policy "admins read games with delivered reports" on public.games
  for select to authenticated
  using (
    public.my_role() in ('admin', 'super_admin')
    and exists (
      select 1 from public.entries e
      where e.game_id = games.id
        and e.status = 'saved_sent'
        and e.sent_at is not null
    )
  );
