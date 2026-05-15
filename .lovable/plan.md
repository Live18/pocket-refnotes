## Goal
Let you click through the post-login UI (Home, Game editor, Admin) in the preview without a working Supabase backend.

## Approach
Add a dev-only "Preview as…" bypass on `/login`, gated by `import.meta.env.DEV` so it cannot ship to production. It fakes a session + `me` payload in the auth context and skips all server calls so the screens render with mock data.

## Changes

1. **`src/lib/auth-context.tsx`**
   - Add a `previewAs(role: "member" | "admin")` method on the context.
   - When a preview session is active, short-circuit `refresh()` to return a mock `me` (fake `userId`, email like `preview-admin@local`, `isAdmin` flag, fake `org_id`) instead of calling `getMe()`.
   - Track preview mode in `sessionStorage` so navigating between routes keeps you "logged in" for the tab.
   - `signOut()` clears the preview flag too.

2. **`src/routes/login.tsx`**
   - Below the real form, render a dev-only block (only when `import.meta.env.DEV`):
     - Two buttons: **Preview as Member** and **Preview as Admin**.
     - Each calls `previewAs(...)` then navigates to `/`.
   - Small caption: "Dev preview only — no real auth, no data is saved."

3. **Server-fn calls in preview mode**
   - `_authenticated/index.tsx`, `games.$gameId.tsx`, `admin.index.tsx`, `admin.invites.tsx` currently call `useServerFn(...)` against Supabase, which will 401/fail.
   - Wrap each `useQuery` so that when `me?.userId.startsWith("preview-")`, it returns hard-coded mock data instead of hitting the server (e.g. 2 fake games, 1 fake game detail, 3 fake members, 1 pending invite).
   - Mutations in preview mode become no-ops with a toast/log.

4. **No backend or schema changes.** Migrations, RLS, and server functions stay exactly as they are.

## Out of scope
- Wiring real Supabase env values (you'll do that separately when the server is up).
- Changing routing, design, or business logic.
- Touching Observation / Mentor.

## After implementation
You'll be able to:
- Open `/login` → click **Preview as Admin** → land on `/` with mock games → open `/admin` → see the members CRUD shell → open a game → see the editor with Save & keep private / Save & send buttons.
- Click **Sign out** to return to `/login`.
