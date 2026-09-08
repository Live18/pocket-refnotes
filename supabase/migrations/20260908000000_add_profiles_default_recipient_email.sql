-- Adds default_recipient_email to profiles, supporting the streamlined Save & Send
-- flow: a referee can set one default recipient (any valid email, not restricted to
-- admin-role accounts) in their own profile settings, then use a checkbox on the
-- report form instead of picking from an admin dropdown each time. Nullable — new
-- users have no default until they visit profile settings; the checkbox renders
-- unchecked/disabled until this is set.
alter table public.profiles
  add column if not exists default_recipient_email text;