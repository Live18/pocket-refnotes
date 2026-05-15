import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGames } from "@/lib/games.functions";
import { useAuth } from "@/lib/auth-context";
import { isPreviewUserId, previewMocks } from "@/lib/preview-mode";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const { me, signOut } = useAuth();
  const list = useServerFn(listGames);
  const isPreview = isPreviewUserId(me?.userId);
  const { data, isLoading } = useQuery({
    queryKey: ["games", isPreview],
    queryFn: isPreview ? async () => ({ games: previewMocks.games }) : () => list(),
  });

  return (
    <div className="px-4 py-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Journal</h1>
          <p className="text-xs text-muted-foreground">Welcome, {me?.email}</p>
        </div>
        <div className="flex gap-2">
          {me?.isAdmin && (
            <Link to="/admin" className="rounded-md border border-border px-3 py-1.5 text-xs">Admin</Link>
          )}
          <button onClick={signOut} className="rounded-md border border-border px-3 py-1.5 text-xs">Sign out</button>
        </div>
      </header>

      <Link
        to="/games/new"
        className="block rounded-lg border border-primary/40 bg-primary/10 p-4 text-center text-sm font-medium hover:scale-105 active:scale-95 transition"
      >+ New game report</Link>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data?.games.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No games yet. Create your first one above.
        </p>
      )}
      <ul className="space-y-2">
        {data?.games.map((g: any) => (
          <li key={g.id}>
            <Link to="/games/$gameId" params={{ gameId: g.id }} className="block rounded-lg border border-border bg-card p-4 hover:scale-[1.02] transition">
              <p className="font-medium">{g.title}</p>
              <p className="text-xs text-muted-foreground">
                {g.game_date ?? "no date"}{g.opponent ? ` · vs ${g.opponent}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
