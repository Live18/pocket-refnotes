-- Enables pg_cron and pg_net (should ship with the standard Supabase Docker
-- image, but this makes the requirement explicit and idempotent).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedules the process-report-jobs edge function to run every minute.
-- It has no meaningful request body — its job is to poll `report_jobs` for
-- queued/failed rows, not to process anything in the request itself.
--
-- REPLACE BEFORE RUNNING (local dev):
--   <LOCAL_SERVICE_ROLE_KEY> -> your local service_role key, from
--   `supabase status` (do NOT use the publishable/anon key here — this
--   function uses secret/service-role auth, per the spec).
--
-- REPLACE AT DEPLOY TIME (Machine B):
--   url        -> the real refnotes.app edge function URL
--   Bearer key -> Machine B's production service_role key
-- This swap is folded into the existing deploy checklist (same item that
-- already covers swapping site_url/additional_redirect_urls).
select cron.schedule(
  'process-report-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := 'http://kong:8000/functions/v1/process-report-jobs',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
      'Content-Type', 'application/json'
    )
  );
  $$
);
