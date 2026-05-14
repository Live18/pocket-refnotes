# Database Migrations (self-hosted)

These SQL files are designed to be run on the **self-hosted Supabase** instance at `RefTechTool.app`. They are NOT applied automatically by Lovable.

## How to apply

On the Ubuntu box, from the Supabase project directory:

```bash
psql "$SUPABASE_DB_URL" -f db/migrations/20260514000001_journal_schema.sql
psql "$SUPABASE_DB_URL" -f db/migrations/20260514000002_rls_policies.sql
```

Or via the Supabase CLI (`supabase db push`) by copying the files into `supabase/migrations/`.

## Order

1. `20260514000001_journal_schema.sql` — tables, enums, triggers, `has_role()`, `current_org_id()`
2. `20260514000002_rls_policies.sql` — RLS policies for every table

## Notes

- `has_role()` is `SECURITY DEFINER` so it bypasses RLS when checked from policies (avoids recursion).
- Entry `body` is **never** readable by anyone other than the author. Admins see profile + last entry meta only — never the body.
- The Docker PDF/email worker uses the **service role** key and bypasses RLS to read entries and write to `report_jobs`.
- Bootstrapping: insert the first org, attach the Super Admin to a profile, then assign the first `admin` role manually via SQL.
