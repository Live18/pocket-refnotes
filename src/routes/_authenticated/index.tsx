import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listGames } from "@/lib/games.functions";
import { useAuth } from "@/lib/auth-context";
import { isPreviewUserId, previewMocks } from "@/lib/preview-mode";
import { AppHeader } from "@/components/AppHeader"; // <-- ADDITION
import { entryStatusLabel, searchItems, type SearchField } from "@/lib/report-search";
import { Highlight, MatchedFields, NoMatches, SearchBox } from "@/components/ReportSearch";
import { GameDetails, formatGameDate } from "@/components/GameDetails";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function gameFields(g: any): SearchField[] {
  const entry = g.entries?.[0];
  return [
    { key: "title", label: "Title", value: g.title },
    { key: "home", label: "Home", value: g.home_team },
    { key: "visiting", label: "Visiting", value: g.visiting_team },
    { key: "location", label: "Location", value: g.location },
    { key: "crew", label: "Crew", value: g.crew },
    { key: "level", label: "Level", value: g.level },
    { key: "gender", label: "Gender", value: g.gender },
    { key: "notes", label: "Notes", value: entry?.body?.text },
    { key: "status", label: "Status", value: entry ? entryStatusLabel(entry.status) : null },
  ];
}

// Fields the card already shows — their matches are highlighted in place, not repeated below.
const ON_CARD = ["title", "level", "gender", "crew"];

function HomePage() {
  const { me } = useAuth(); // <-- CHANGE: was { me, signOut } — signOut now lives inside AppHeader
  const list = useServerFn(listGames);
  const isPreview = isPreviewUserId(me?.userId);
  const { data, isLoading } = useQuery({
    queryKey: ["games", isPreview],
    queryFn: isPreview ? async () => ({ games: previewMocks.games }) : () => list(),
  });

  const [query, setQuery] = useState("");
  const games: any[] = data?.games ?? [];
  const search = useMemo(() => searchItems(games, query, gameFields), [games, query]);

  return (
    <div className="px-4 py-6 space-y-4">
      <AppHeader title="Journal" /> {/* <-- CHANGE: was the whole inline <header> block with ViewingBadge/Admin/Settings/Sign out — all moved into AppHeader */}

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
      {games.length > 0 && (
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search games — teams, crew, location, notes…"
          mode={search.mode}
          shown={search.results.length}
          total={games.length}
          noun="games"
        />
      )}
      {games.length > 0 && search.results.length === 0 && <NoMatches query={query} noun="games" />}
      <ul className="space-y-2">
        {search.results.map(({ item: g, matches }) => (
          <li key={g.id}>
            <Link to="/games/$gameId" params={{ gameId: g.id }} className="block rounded-lg border border-border bg-card p-4 hover:scale-[1.02] transition">
              <p className="font-medium">
                <Highlight text={g.title} ranges={matches.title?.ranges} />
              </p>
              <p className="text-xs text-muted-foreground">
                {formatGameDate(g.game_date)}{g.opponent ? ` · vs ${g.opponent}` : ""}
              </p>
              <GameDetails game={g} matches={matches} />
              <MatchedFields matches={matches} onCard={ON_CARD} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
