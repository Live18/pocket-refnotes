
# Journal Build Plan

Scope: Journal only. Two roles (admin, member). Self-hosted Supabase at `RefTechTool.app`. PDF+email handled by an external Docker worker (out of scope — placeholder wiring only).

---

## 1. Mental model

- One **entry** per game. Entry holds the user's notes for that game.
- Entry has a **status**: `draft` → (`saved_private` | `saved_sent`).
- "Personal note" is not a separate object. It's just an entry the user chose **Save & don't send** on.
- "Send" = enqueue a job for the Docker worker. Worker reads the saved entry from Supabase, renders PDF, sends via Resend, writes status back.

This collapses a lot: no separate notes table, no separate share model, no archive UI.

---

## 2. Backend (Supabase, self-hosted)

User wires the actual instance later; we build against placeholder env vars.

**Env placeholders** (in `.env` / Lovable secrets):
- `VITE_SUPABASE_URL` = `https://reftechtool.app` (placeholder)
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `PDF_WORKER_CALLBACK_SECRET` (HMAC for worker → app callback)

**Schema (migrations the user runs on their box):**

```text
orgs(id, name, created_at)
profiles(id=auth.uid, org_id, display_name, email, created_at)
app_role enum: 'admin' | 'member'
user_roles(id, user_id, org_id, role, unique(user_id, org_id, role))
invites(id, org_id, email, role, token, invited_by, expires_at, accepted_at)
games(id, org_id, created_by, title, game_date, opponent, location, created_at)
entries(
  id, game_id, author_id, org_id,
  body jsonb,                       -- structured journal fields
  status text,                      -- 'draft'|'saved_private'|'saved_sent'
  recipient_email text,             -- where to send when status='saved_sent'
  saved_at, sent_at, created_at, updated_at
)
report_jobs(
  id, entry_id, status,             -- 'queued'|'rendering'|'sent'|'failed'
  attempts int, last_error text,
  created_at, updated_at
)
```

**Security**: `has_role(user_id, org_id, role)` SECURITY DEFINER fn. RLS:
- members: read/write their own entries/games; read their own profile.
- admins: read profiles + last entry summary in their org; manage invites + roles.
- nobody reads entry `body` except the author (admin included — confirmed: admin can't see content).

---

## 3. App-side server functions (TanStack `createServerFn`)

`src/lib/`:
- `auth.functions.ts` — `acceptInvite(token)`, `getMe()`
- `admin.functions.ts` — `listMembers()`, `inviteMember(email, role)`, `resendInvite(id)`, `revokeInvite(id)`, `changeRole(userId, role)`, `removeMember(userId)`, `getMemberSummary(userId)` (returns last entry meta only — date, game title, status — no body)
- `games.functions.ts` — `listGames()`, `createGame(...)`, `getGame(id)`
- `entries.functions.ts` — `getDraft(gameId)`, `saveDraft(gameId, body)`, `savePrivate(entryId)`, `saveAndSend(entryId, recipientEmail)`
- `reports.functions.ts` — `enqueueReport(entryId, recipientEmail)` (inserts `report_jobs` row), `getJobStatus(entryId)`

**Worker contract (out of scope, documented for the user's Claude session):**
- Worker polls/listens to `report_jobs` where `status='queued'`.
- Worker uses service role to read the entry, renders PDF, sends via Resend, updates job + entry `sent_at`.
- Optional: worker POSTs to `/api/public/report-callback` with HMAC to push status. We'll stub this route.

---

## 4. Routes

```text
/login                          public
/accept-invite/$token           public
/_authenticated/                gate
  /                             member home — list of games + "New entry"
  /games/$gameId                entry editor (save private / save & send)
  /entries                      list of own entries (status + game)
/_authenticated/_admin/         gate (requires admin role)
  /admin                        members list
  /admin/invites                pending invites
  /admin/members/$userId        member detail + last entry meta
```

---

## 5. Onboarding flows

**Admin onboarding (first time after Super Admin assigns admin role):**
1. Land on `/admin` → empty state: "Invite your first member."
2. 3-step inline checklist: confirm org name → invite ≥1 member → done.
3. Persist `onboarding_completed_at` on profile.

**Member onboarding (after accepting invite):**
1. `/accept-invite/$token` → set password → redirected to `/`.
2. First-run modal: "Create your first journal entry" → CTA opens new-game form.
3. Tooltip walkthrough on the editor (3 steps): write → choose recipient → Save & send vs Save private.
4. Persist `onboarding_completed_at`.

---

## 6. Entry editor UX (the core flow)

Single screen per game:
- Game metadata header (date, opponent, location — editable until first save).
- Journal body fields (TBD per Journal spec — keep current shape).
- Autosave to `entries` as `draft` every N seconds.
- Footer actions:
  - **Save & keep private** → status `saved_private`, no job.
  - **Save & send report** → opens recipient prompt → status `saved_sent` + insert `report_jobs`.
  - Status pill shows job state (queued / sent / failed + retry).

Drafts live in Supabase (not localStorage) — works across devices, matches "saved on my server."

---

## 7. Things we are explicitly NOT building

- Docker PDF/email worker itself (user + Claude).
- Resend account wiring (user holds keys).
- Super Admin shell (separate app).
- Long-term archive, search, tagging, sharing-with-other-members.
- Mentor / Observer roles.
- Observation and Mentor apps.

---

## 8. Build order

1. Supabase client wiring + env placeholders + auth helpers.
2. Schema migration files (committed; user runs on box).
3. RBAC: `app_role`, `user_roles`, `has_role`, `_authenticated` + `_admin` gates.
4. Member flow: games list → editor → save private / save & send → job row.
5. `/api/public/report-callback` HMAC stub.
6. Admin surface: members CRUD + invites + last-entry meta.
7. Onboarding (admin checklist + member first-run).
8. Polish: empty states, error boundaries, status pills.

---

## Technical notes

- Use `requireSupabaseAuth` middleware on every server fn except invite acceptance.
- Admin fns also gate on `has_role(uid, org_id, 'admin')` server-side — never trust client role.
- `report_jobs` inserts use the user's RLS context; worker uses service role.
- Callback route under `/api/public/` with HMAC verification (skill: public-api-endpoints).
- No Lovable Cloud, no Edge Functions. Pure self-hosted Supabase + TanStack server fns.

Ready to switch to build mode on your go.
