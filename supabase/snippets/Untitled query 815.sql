update report_jobs
set notified_at = null,
    updated_at = now() - interval '16 minutes'
where entry_id = '57054fcc-da7c-4c8d-a27e-68e990065761';