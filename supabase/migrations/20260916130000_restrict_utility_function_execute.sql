-- supabase/migrations/20260916130000_restrict_utility_function_execute.sql

-- Migration-audit drift found Sep 16: these four functions had execute
-- restricted directly on the live local DB (likely via SQL Editor), but no
-- migration ever captured it. Without this, a fresh deploy (Machine B)
-- would default to open execute access on these functions instead.

revoke all on function public.handle_new_user() from anon, authenticated, service_role;
revoke all on function public.my_is_active() from anon, authenticated, service_role;
revoke all on function public.my_role() from anon, authenticated, service_role;
revoke all on function public.touch_updated_at() from anon, authenticated, service_role;