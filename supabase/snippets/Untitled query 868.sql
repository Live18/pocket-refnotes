select cron.schedule(
  'process-report-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/process-report-jobs',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
      'Content-Type', 'application/json'
    )
  );
  $$
);