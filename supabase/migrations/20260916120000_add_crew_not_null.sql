-- Crew field was accepting empty/whitespace values on New Game submissions.
-- NOT NULL blocks a missing value; the CHECK also blocks an empty/whitespace-only string,
-- since NOT NULL alone doesn't catch ''.
ALTER TABLE games ALTER COLUMN crew SET NOT NULL;
ALTER TABLE games ADD CONSTRAINT games_crew_not_blank CHECK (btrim(crew) <> '');