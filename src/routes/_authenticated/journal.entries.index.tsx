import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useServerFn } from "@tanstack/react-start";
import { listMyEntries } from "@/lib/entries.functions";
import { entryStatusLabel, searchItems, type FieldMatch, type SearchField } from "@/lib/report-search";
import { Highlight, MatchedFields, NoMatches, SearchBox } from "@/components/ReportSearch";
import { GameDetails, formatGameDate } from "@/components/GameDetails";

export const Route = createFileRoute("/_authenticated/journal/entries/")({
  component: EntriesList,
});

type EntryRow = {
  id: string;
  status: "draft" | "saved_private" | "saved_sent" | "send_failed";
  recipient_email: string | null;
  saved_at: string | null;
  sent_at: string | null;
  updated_at: string;
  body: { text?: string } | null;
  game: {
    id: string;
    title: string;
    game_date: string;
    location: string | null;
    gender: string | null;
    level: string | null;
    crew: string | null;
    home_team: string | null;
    visiting_team: string | null;
  } | null; // join returns a single object, not an array
};

function entryFields(e: EntryRow): SearchField[] {
  const g = e.game;
  return [
    { key: "title", label: "Title", value: g?.title ?? "Untitled game" },
    { key: "home", label: "Home", value: g?.home_team },
    { key: "visiting", label: "Visiting", value: g?.visiting_team },
    { key: "location", label: "Location", value: g?.location },
    { key: "crew", label: "Crew", value: g?.crew },
    { key: "level", label: "Level", value: g?.level },
    { key: "gender", label: "Gender", value: g?.gender },
    { key: "notes", label: "Notes", value: e.body?.text },
    { key: "status", label: "Status", value: entryStatusLabel(e.status) },
  ];
}

// Fields the card already shows — their matches are highlighted in place, not repeated below.
const ON_CARD = ["title", "level", "gender", "crew", "status"];

function EntriesList() {
  const navigate = useNavigate();
  const listMyEntriesFn = useServerFn(listMyEntries);

  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const search = useMemo(() => searchItems(entries, query, entryFields), [entries, query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await listMyEntriesFn();
        if (!cancelled) setEntries(result.entries as unknown as EntryRow[]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load entries.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title="Journal Archive" />
      <div className="flex items-center justify-between px-5 pb-3">
        <Link to="/journal" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>

      {!loading && entries.length > 0 && (
        <div className="px-5 pb-3">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search reports — teams, crew, location, notes…"
            mode={search.mode}
            shown={search.results.length}
            total={entries.length}
            noun="reports"
          />
        </div>
      )}

      {error && (
        <div className="mx-5 mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && (
        <div className="mx-5 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Loading entries…
        </div>
      )}

      {!loading && (
        <ul className="flex flex-col gap-2 px-5 pb-8">
          {entries.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No entries yet. Create your first journal.
            </li>
          )}
          {entries.length > 0 && search.results.length === 0 && (
            <li>
              <NoMatches query={query} noun="reports" />
            </li>
          )}
          {search.results.map(({ item: e, matches }) => (
            <EntryListItem
              key={e.id}
              entry={e}
              matches={matches}
              onOpen={() => navigate({ to: "/journal/entries/$id", params: { id: e.id } })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryListItem({
  entry,
  matches,
  onOpen,
}: {
  entry: EntryRow;
  matches: Record<string, FieldMatch>;
  onOpen: () => void;
}) {
  const game = entry.game;
  return (
    <li
      onClick={onOpen}
      className="flex gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
      style={{ boxShadow: "var(--shadow-tile)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base font-semibold">
            <Highlight text={game?.title ?? "Untitled game"} ranges={matches.title?.ranges} />
          </h3>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {game?.game_date ? formatGameDate(game.game_date) : ""}
          </span>
        </div>

        {game && <GameDetails game={game} matches={matches} />}
        <MatchedFields matches={matches} onCard={ON_CARD} />

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className={
              entry.status === "saved_sent"
                ? "text-foreground"
                : entry.status === "send_failed"
                ? "text-destructive"
                : "opacity-70"
            }
          >
            <Highlight text={entryStatusLabel(entry.status)} ranges={matches.status?.ranges} />
          </span>
        </div>
      </div>
    </li>
  );
}
