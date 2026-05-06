# Plan: RBAC Foundation + Multi-Tenant Backend

Based on your answers:
- **Mentors**: any-mentor-sees-shared model now; pairing later.
- **Org admins**: oversight model — admins read all entries in their org.
- **Onboarding**: auto-create personal org on signup + invite system (both directions).
- **Super admin**: yes, platform-level role for support.

This plan covers the foundation (steps 1–4 from the discussion). Org management UI, mentor sharing rewire, and video come in follow-up plans.

---

## Phase 1 — Auth & user identity

**Enable Lovable Cloud** (Supabase under the hood).

**Auth methods**: Email/password + Google sign-in (Lovable Cloud defaults).

**Profiles table** — yes, we need one (display name, avatar, etc. for invites and mentor UI):
```text
profiles
  id uuid PK → auth.users(id) ON DELETE CASCADE
  display_name text
  avatar_url text
  created_at timestamptz
```
Auto-created via trigger on signup. RLS: users read all profiles in orgs they share; update only own.

**Routes added**:
- `/login`, `/signup`, `/forgot-password`, `/reset-password` (public)
- `_authenticated` pathless layout route guarding everything else
- Existing `/`, `/journal/*`, `/observation`, `/mentor` move under `_authenticated`

---

## Phase 2 — Tenancy & RBAC schema

### Enums
```text
app_role:  'super_admin'
org_role:  'org_owner' | 'org_admin' | 'mentor' | 'member'
           (ordered: member < mentor < org_admin < org_owner)
```

### Tables

```text
organizations
  id, name, slug, oversight_enabled bool (future-proofing), created_at, owner_id

organization_members
  id, org_id FK, user_id FK, role org_role, joined_at
  UNIQUE(org_id, user_id)

organization_invites
  id, org_id FK, email citext, role org_role, token uuid,
  invited_by uuid, expires_at, accepted_at, created_at
  -- supports both "I invite you to my org" and "I request to join your org"
  -- (direction encoded by who creates the row)

user_roles
  id, user_id FK, role app_role
  UNIQUE(user_id, role)
  -- platform-level only (super_admin). Org roles live in organization_members.
```

### SECURITY DEFINER helpers (avoid recursive RLS)
```text
public.is_org_member(_user, _org) → boolean
public.has_org_role(_user, _org, _min_role) → boolean   -- ordered comparison
public.has_platform_role(_user, _role) → boolean
public.user_orgs(_user) → setof uuid                    -- for listing
```

### Auto-org trigger
On `auth.users` insert: create personal org named "{display_name}'s Workspace", add user as `org_owner`.

---

## Phase 3 — Entries schema

Three near-identical tables (kept separate so they can evolve independently):

```text
journal_entries / observation_entries / mentor_entries
  id uuid PK
  org_id uuid FK → organizations(id)        -- denormalized for fast RLS
  user_id uuid FK → auth.users(id)          -- author
  title text
  body text
  tags text[]                                -- starting as array; normalize later if needed
  game_datetime timestamptz
  venue text
  home_team text
  visiting_team text
  crew text                                  -- single text field for now
  shared_with_mentors bool default false     -- role-based sharing toggle
  notify_recipients text[]                   -- explicit email notifications (optional layer)
  shared_at timestamptz                      -- first-shared timestamp
  created_at, updated_at, edited_at timestamptz
```

`mentor_entries` adds:
```text
  video_url text                             -- link-only for now (upload later)
  video_provider text                        -- 'youtube' | 'vimeo' | 'other'
```

### RLS policies (same shape on all three tables)

```sql
-- SELECT
user_id = auth.uid()
OR (shared_with_mentors AND has_org_role(auth.uid(), org_id, 'mentor'))
OR has_org_role(auth.uid(), org_id, 'org_admin')   -- oversight
OR has_platform_role(auth.uid(), 'super_admin')

-- INSERT
user_id = auth.uid() AND is_org_member(auth.uid(), org_id)

-- UPDATE / DELETE
user_id = auth.uid()
OR has_org_role(auth.uid(), org_id, 'org_admin')
OR has_platform_role(auth.uid(), 'super_admin')
```

---

## Phase 4 — Data layer rewrite

Replace `localStorage`-backed contexts with `createServerFn` calls protected by `requireSupabaseAuth`.

**New files**:
- `src/server/journal.functions.ts` — list/get/create/update/delete/share
- `src/server/observation.functions.ts` — same shape
- `src/server/mentor.functions.ts` — same shape + video field
- `src/server/orgs.functions.ts` — list my orgs, switch active org, create org
- `src/server/invites.functions.ts` — send invite, accept invite, list pending, request to join
- `src/server/profile.functions.ts` — get/update my profile

**Existing files rewired** (no UI changes, just data source swap):
- `src/lib/journal.tsx` → thin wrapper around server fns + TanStack Query (or simple `useEffect` cache)
- `src/lib/permissions.tsx` → derives `hasAccess` from real org roles
- `src/lib/admin.tsx` → checks `super_admin` or `org_admin`
- `src/routes/journal.entries.tsx`, `journal.entries.$id.tsx`, `journal.new.tsx` → call server fns

### Active-org concept
Users in 2+ orgs need to know "which org am I writing into right now?" Store in `localStorage` (`refnotes.activeOrgId`), default to personal org, expose via `useActiveOrg()` hook. Org switcher UI comes in a later plan; the hook ships now so server fns can scope queries.

---

## What this plan does NOT include (separate plans)

1. Org management UI (settings page, member list, role changes, org switcher in header)
2. Invite flow UI (send invite form, accept invite landing page, "request to join" UI)
3. Mentor sharing UI rewire (replace email-recipients picker with "share with mentors" toggle)
4. Mentor reply / notification ping feature
5. Mentor video upload (Supabase Storage) — link-only field exists from day one
6. Migration of existing `localStorage` seed data (will be lost on cutover; acceptable since it's demo data)

---

## Files touched (foundation phase)

**Created (migrations)**:
- 1 migration: enums, profiles, organizations, organization_members, organization_invites, user_roles, helpers, triggers
- 1 migration: journal_entries, observation_entries, mentor_entries with RLS

**Created (code)**:
- `src/routes/_authenticated.tsx`
- `src/routes/login.tsx`, `signup.tsx`, `forgot-password.tsx`, `reset-password.tsx`
- `src/server/{journal,observation,mentor,orgs,invites,profile}.functions.ts`
- `src/lib/active-org.tsx` (hook + provider)

**Moved** (under `_authenticated`):
- `src/routes/index.tsx` → `_authenticated/index.tsx`
- `src/routes/journal.*` → `_authenticated/journal.*`
- `src/routes/observation.tsx`, `mentor.tsx` → `_authenticated/`

**Edited**:
- `src/routes/__root.tsx` — auth context wiring
- `src/lib/{journal,permissions,admin}.tsx` — point at server fns
- `src/router.tsx` — auth context type

**Auto-regenerated**: `routeTree.gen.ts`

---

## Realistic time/scope expectation

This is a meaningful chunk — probably the biggest single change since the project started. After it ships you'll have:
- Real auth, real users, real persistence
- Org isolation enforced at the DB level
- A clean foundation for invites, mentor pairing, video, billing, etc.

But the UI you've already built barely changes — animations, wizard flows, layout, tiles all stay. The work is mostly invisible plumbing.

Approve this and I'll execute Phase 1 + Phase 2 in the first build pass (auth working, schema in place), then Phase 3 + Phase 4 in the second pass (entries persist to DB, RLS active). I'll pause between passes so you can sanity-check.
