update entries set recipient_email = 'not-a-valid-email' where id = '57054fcc-da7c-4c8d-a27e-68e990065761';

update report_jobs set status = 'queued', attempts = 0, last_error = null where entry_id = '57054fcc-da7c-4c8d-a27e-68e990065761';