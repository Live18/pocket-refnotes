import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useServerFn } from "@tanstack/react-start";
import { listMyEntries } from "@/lib/entries.functions";

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
  game: { id: string; title: string; game_date: string } | null; // <-- CHANGE: was `{...}[] | null` — join returns a single object, not an array
};

function statusLabel(status: EntryRow["status"]) {
  if (status === "saved_sent") return "Sent";
  if (status === "saved_private") return "Saved";
  if (status === "send_failed") return "Send failed";
  return "Draft";
}

function EntriesList() {
  const navigate = useNavigate();
  const listMyEntriesFn = useServerFn(listMyEntries);

  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await listMyEntriesFn();
        if (!cancelled) setEntries(result.entries as EntryRow[]);
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
          {entries.map((e) => (
            <EntryListItem
              key={e.id}
              entry={e}
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
  onOpen,
}: {
  entry: EntryRow;
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
          <h3 className="truncate text-base font-semibold">{game?.title ?? "Untitled game"}</h3>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {game?.game_date ? new Date(game.game_date).toLocaleDateString() : ""}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className={
              entry.status === "saved_sent"
                ? "text-foreground"
                : entry.status === "send_failed"
                ? "text-destructive"
                : "opacity-70"
            }
          >
            {statusLabel(entry.status)}
          </span>
        </div>
      </div>
    </li>
  );
}