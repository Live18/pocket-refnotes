-- supabase/migrations/20260916140000_revoke_sequence_update_privilege.sql

-- Migration-audit drift found Sep 16: local dev DB had `UPDATE` on sequences
-- granted to anon/authenticated/service_role directly (not via any migration).
-- Confirmed via repo-wide search: no setval()/nextval() usage anywhere, so
-- nothing needs this beyond default sequence USAGE (already granted by
-- Postgres by default for normal auto-increment inserts). Revoking to close
-- the gap between local dev and what deploying `supabase/migrations` alone
-- would produce.

revoke update on all sequences in schema public from anon, authenticated, service_role;

alter default privileges in schema public revoke update on sequences from anon, authenticated, service_role;