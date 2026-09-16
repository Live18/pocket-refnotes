-- Add game classification fields: gender, level (plain text per Bill's decision),
-- plus separate home/visiting team columns replacing the old single "opponent" field for new games.
-- games table confirmed test-data-only (Sep 2026) - safe to add NOT NULL columns without defaults.
alter table public.games
  add column gender text not null,
  add column level text not null,
  add column home_team text not null,
  add column visiting_team text not null;