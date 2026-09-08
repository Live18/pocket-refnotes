-- Adds notified_at to report_jobs: marks a `failed` job as already included
-- in a Super Admin digest email, so it is never reported twice.
-- NULL = not yet notified. Set by the process-report-jobs edge function
-- once a digest email successfully sends.
alter table public.report_jobs
  add column notified_at timestamptz null;
