-- Adds 'send_failed' as a new entries.status value — distinct from draft/saved_private/
-- saved_sent. Purely for badge/visibility purposes: under the hood it behaves exactly like
-- saved_private (same edit form, same "Save & Send" button re-triggers a fresh send). Closes
-- the gap where a referee's own view still shows "Sent" forever even if all 3 send retries
-- failed (previously only the Super Admin digest email knew).
alter type public.entry_status add value if not exists 'send_failed';