-- Widen game_date to capture time, not just date
alter table public.games
  alter column game_date type timestamptz using game_date::timestamptz;

-- Add crew as plain text (supports non-app-user referees; no FK to profiles)
alter table public.games
  add column crew text;