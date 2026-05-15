// Dev-only preview bypass. Lets you click through post-login screens
// without a real Supabase backend. Gated by import.meta.env.DEV at the
// call sites; this module is safe to import anywhere.

const KEY = "lovable.previewAs";

export type PreviewRole = "member" | "admin";

export function getPreviewRole(): PreviewRole | null {
  if (typeof window === "undefined") return null;
  const v = window.sessionStorage.getItem(KEY);
  return v === "admin" || v === "member" ? v : null;
}

export function setPreviewRole(role: PreviewRole | null) {
  if (typeof window === "undefined") return;
  if (role) window.sessionStorage.setItem(KEY, role);
  else window.sessionStorage.removeItem(KEY);
}

export function isPreviewUserId(userId: string | undefined | null) {
  return !!userId && userId.startsWith("preview-");
}

export function previewMe(role: PreviewRole) {
  const userId = `preview-${role}`;
  return {
    userId,
    email: `${userId}@local`,
    profile: {
      id: userId,
      org_id: "preview-org",
      display_name: role === "admin" ? "Preview Admin" : "Preview Member",
      email: `${userId}@local`,
      onboarding_completed_at: new Date().toISOString(),
    },
    roles: [{ role, orgId: "preview-org" }],
    isAdmin: role === "admin",
  };
}

// Mock data used by route components when in preview mode.
export const previewMocks = {
  games: [
    { id: "preview-game-1", title: "Lakers @ Celtics", game_date: "2026-05-10", opponent: "Celtics", location: "TD Garden" },
    { id: "preview-game-2", title: "Warriors @ Nuggets", game_date: "2026-05-12", opponent: "Nuggets", location: "Ball Arena" },
  ],
  game: (id: string) => ({
    id,
    title: id === "preview-game-2" ? "Warriors @ Nuggets" : "Lakers @ Celtics",
    game_date: "2026-05-10",
    opponent: "Celtics",
    location: "TD Garden",
  }),
  entry: (gameId: string) => ({
    id: `preview-entry-${gameId}`,
    game_id: gameId,
    body: { text: "Sample notes from the first half...\n\n- Foul count high\n- Pace was clean" },
    recipient_email: "assignor@example.com",
    status: "draft" as const,
    sent_at: null as string | null,
  }),
  members: [
    { id: "preview-admin", email: "preview-admin@local", display_name: "Preview Admin", roles: ["admin"], lastEntry: null },
    { id: "preview-member", email: "preview-member@local", display_name: "Preview Member", roles: ["member"], lastEntry: { game: { title: "Lakers @ Celtics" }, status: "saved_sent", sent_at: new Date().toISOString() } },
    { id: "preview-member-2", email: "rookie@local", display_name: "Rookie Ref", roles: ["member"], lastEntry: null },
  ],
  invites: [
    { id: "preview-invite-1", email: "pending@example.com", role: "member", accepted_at: null, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() },
  ],
};
