-- Close a gap in "authors manage own entries": the write check only required
-- author_id = auth.uid(), so a signed-in user who knew another referee's game id could
-- attach their own report to that game (and, by sending it, have that game's details
-- emailed to an address of their choosing). Writes now also require that the game
-- belongs to the author. Reads are unchanged.
--
-- The ownership check goes through a SECURITY DEFINER helper rather than a plain
-- subquery on games: games' "admins read games with delivered reports" policy queries
-- entries, so a direct subquery here would make the two policies recurse
-- ("infinite recursion detected in policy for relation entries").

create or replace function public.is_own_game(game uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.games where id = game and created_by = auth.uid())
$$;

-- Only signed-in users need it (RLS evaluates it as the calling role).
revoke all on function public.is_own_game(uuid) from public, anon;
grant execute on function public.is_own_game(uuid) to authenticated;

drop policy if exists "authors manage own entries" on public.entries;
create policy "authors manage own entries" on public.entries
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and public.is_own_game(game_id));
