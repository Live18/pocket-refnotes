import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react"; // <-- CHANGE: added useEffect (need to fetch on mount now)
import { AppHeader } from "@/components/AppHeader";
import { useServerFn } from "@tanstack/react-start";
import { listMyEntries } from "@/lib/entries.functions"; // <-- ADDITION: real backend call, replaces useJournal()

export const Route = createFileRoute("/journal/entries")({
  component: EntriesList,
});

// <-- ADDITION: shape of what listMyEntries actually returns per row
// (id, status, recipient_email, saved_at, sent_at, updated_at, game:games(id, title, game_date))
type EntryRow = {
  id: string;
  status: "draft" | "saved_private" | "saved_sent" | "send_failed";
  recipient_email: string | null;
  saved_at: string | null;
  sent_at: string | null;
  updated_at: string;
  game: { id: string; title: string; game_date: string }[] | null;
};

// <-- ADDITION: small local status label helper (was previously derived from
// fake sharedAt/editedAt fields on the old JournalEntry type, which no longer exists)
function statusLabel(status: EntryRow["status"]) {
  if (status === "saved_sent") return "Sent";
  if (status === "saved_private") return "Saved";
  if (status === "send_failed") return "Send failed";
  return "Draft";
}

function EntriesList() {
  // <-- REMOVED: const { entries, remove, setShared, addTag } = useJournal();
  // (all fake/localStorage-backed — replaced with real state below)
  const navigate = useNavigate();
  const listMyEntriesFn = useServerFn(listMyEntries);

  // <-- ADDITION: real data-fetch state (loading/error), per standing
  // failure-handling convention — no more instant fake data from useJournal()
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // <-- ADDITION: fetch real entries on mount
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

  // <-- REMOVED: all selection/bulk-action state and handlers
  // (selected, tagPrompt, tagValue, toggle, clear, onDelete, onShareToggle,
  // onTag, exportSelected, printSelected, escapeHtml) — none of these are
  // backed by real functionality yet; deferred to a future build per Sep 5 decision

  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title="Journal Archive" />
      <div className="flex items-center justify-between px-5 pb-3">
        <Link to="/journal" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>

      {/* <-- ADDITION: real error banner, per standing error-handling convention */}
      {error && (
        <div className="mx-5 mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* <-- ADDITION: real loading state */}
      {loading && (
        <div className="mx-5 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Loading entries…
        </div>
      )}

      {/* <-- REMOVED: selectMode toolbar (bulk share/unshare/tag/export/print/delete) */}
      {/* <-- REMOVED: tagPrompt input */}

      {!loading && (
        <ul className="flex flex-col gap-2 px-5 pb-8">
          {entries.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No entries yet. Create your first journal.
            </li>
          )}
          {entries.map((e) => (
            <EntryRow
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

// <-- REMOVED: IconBtn component (only used by the removed bulk-action toolbar)

function EntryRow({
  entry,
  onOpen,
}: {
  entry: EntryRow;
  onOpen: () => void;
}) {
  const game = entry.game?.[0];
  return (
    <li
      onClick={onOpen} // <-- CHANGE: always opens detail now, no select-mode branch
      className="flex gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
      style={{ boxShadow: "var(--shadow-tile)" }}
    >
      {/* <-- REMOVED: select checkbox button */}

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          {/* <-- CHANGE: entry.title -> entry.game?.title (title lives on the game, not the entry) */}
          <h3 className="truncate text-base font-semibold">{game?.title ?? "Untitled game"}</h3>
          {/* <-- CHANGE: timeAgo(entry.createdAt) -> plain date string; timeAgo came from the
               removed fake @/lib/journal module, and entries have no createdAt of their own
               (games do, via game_date) -- kept simple per "frictionless" request */}
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {game?.game_date ? new Date(game.game_date).toLocaleDateString() : ""}
          </span>
        </div>

        {/* <-- REMOVED: entry.body preview line (listMyEntries doesn't select body;
             pulling it back in just for a list preview isn't in scope for this pass) */}

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {/* <-- ADDITION: real status badge, replaces fake sharedAt/editedAt display */}
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