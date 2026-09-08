-- service_role is meant to have full data access (bypass RLS) on every table
-- by default, per standard Supabase project setup. This project's original
-- schema migration was missing these grants entirely — service_role only had
-- TRUNCATE/TRIGGER/REFERENCES, not SELECT/INSERT/UPDATE/DELETE, on every
-- table (confirmed via information_schema.role_table_grants, Sep 7 2026).
-- Not something introduced by today's work — a pre-existing gap surfaced by
-- process-report-jobs being the first feature to actually use service_role
-- for table access.
grant select, insert, update, delete on all tables in schema public to service_role;

-- Ensures any table created after this migration also gets these grants
-- automatically, so this doesn't recur on future tables.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
