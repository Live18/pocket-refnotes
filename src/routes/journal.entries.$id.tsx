import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react"; // <-- CHANGE: added useEffect (need to fetch on mount now)
import { Pencil, Save, X } from "lucide-react"; // <-- CHANGE: dropped Share2, Trash2 — Share/Unshare and Delete buttons removed this pass
import { AppHeader } from "@/components/AppHeader";
import { useServerFn } from "@tanstack/react-start"; // <-- ADDITION
import { getEntryById, savePrivate } from "@/lib/entries.functions"; // <-- ADDITION: replaces useJournal()
// <-- REMOVED: import { useJournal, timeAgo } from "@/lib/journal";

export const Route = createFileRoute("/journal/entries/$id")({
  component: EntryDetail,
});

// <-- ADDITION: shape returned by getEntryById (mirrors listMyEntries's row shape, plus body)
type EntryDetailRow = {
  id: string;
  status: "draft" | "saved_private" | "saved_sent" | "send_failed";
  recipient_email: string | null;
  body: { notes?: string } | null;
  saved_at: string | null;
  sent_at: string | null;
  updated_at: string;
  game: { id: string; title: string; game_date: string }[] | null;
};

// <-- ADDITION: same status label as the list view (journal.entries.tsx) — kept local
// rather than shared, matching that file's existing style of not extracting small helpers
function statusLabel(status: EntryDetailRow["status"]) {
  if (status === "saved_sent") return "Sent";
  if (status === "saved_private") return "Saved";
  if (status === "send_failed") return "Send failed";
  return "Draft";
}

function EntryDetail() {
  const { id } = Route.useParams();
  const getEntryByIdFn = useServerFn(getEntryById); // <-- ADDITION
  const savePrivateFn = useServerFn(savePrivate); // <-- ADDITION

  // <-- REMOVED: const { get, update, remove, setShared } = useJournal();
  // <-- REMOVED: const entry = get(id); (was synchronous/instant from localStorage)

  // <-- ADDITION: real fetch state, per standing error-handling convention
  const [entry, setEntry] = useState<EntryDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(""); // <-- CHANGE: no more title state — title lives on the game, not editable here
  const [saving, setSaving] = useState(false); // <-- ADDITION: busy state for Save button
  const [saveError, setSaveError] = useState<string | null>(null); // <-- ADDITION

  // <-- ADDITION: fetch real entry on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getEntryByIdFn({ data: { id } });
        const fetched = result.entry as EntryDetailRow | null;
        if (!cancelled) {
          setEntry(fetched);
          setBody(fetched?.body?.notes ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load entry.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // <-- ADDITION: real loading state, matches list view's pattern
  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">Loading entry…</p>
      </div>
    );
  }

  // <-- ADDITION: real error state (separate from "not found" below)
  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5">
        <p className="text-sm text-destructive">{error}</p>
        <Link to="/journal/entries" className="font-mono text-[10px] uppercase tracking-[0.2em] underline">
          Back to archive
        </Link>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5">
        <p className="text-sm text-muted-foreground">Entry not found.</p>
        <Link to="/journal/entries" className="font-mono text-[10px] uppercase tracking-[0.2em] underline">
          Back to archive
        </Link>
      </div>
    );
  }

  const game = entry.game?.[0]; // <-- ADDITION: Supabase types the FK join as an array even for a single-row join

  // <-- CHANGE: onSave is now async and always calls savePrivate (Option 2 — editing +
  // Save results in "saved_private" whether the entry started as draft or saved_private;
  // no separate draft-only edit path)
  const onSave = async () => {
    if (!game) return;
    try {
      setSaving(true);
      setSaveError(null);
      const result = await savePrivateFn({
        data: { gameId: game.id, body: { notes: body } },
      });
      setEntry(result.entry as EntryDetailRow);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  // <-- REMOVED: onDelete — Delete button removed this pass, deferred to a future version

  const canEdit = entry.status !== "saved_sent"; // <-- ADDITION: sent entries are terminal, no editing

  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title="Entry" />
      <div className="flex items-center justify-between px-5 pb-3">
        <Link to="/journal/entries" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          ← Archive
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-8">
        {/* <-- ADDITION: inline save-error banner, per standing error-handling convention */}
        {saveError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {saveError}
          </div>
        )}

        {editing ? (
          <>
            {/* <-- REMOVED: title <input> — title lives on the game, not editable here */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex-1 min-h-[260px] rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                onClick={onSave}
                disabled={saving} // <-- ADDITION: busy state
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
              >
                <Save size={14} /> {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setEditing(false); setBody(entry.body?.notes ?? ""); setSaveError(null); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-mono text-xs uppercase tracking-[0.2em]"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {/* <-- CHANGE: entry.title -> game?.title (title lives on the game, not the entry) */}
            <h2 className="text-2xl font-semibold leading-tight">{game?.title ?? "Untitled game"}</h2>

            {/* <-- CHANGE: replaced createdAt/editedAt/sharedAt (fake fields from the removed
                 useJournal module) with the real game date + status label */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {game?.game_date && <span>{new Date(game.game_date).toLocaleDateString()}</span>}
              <span className={
                  entry.status === "saved_sent"
                    ? "text-foreground"
                    : entry.status === "send_failed"
                    ? "text-destructive"
                    : "opacity-70"
                }
              >
                · {statusLabel(entry.status)}
              </span>
            </div>

            {/* <-- REMOVED: tags display block — deferred to a future version */}

            <p className="whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">
              {entry.body?.notes ?? ""}
            </p>

            {/* <-- CHANGE: single Edit button only; Share/Unshare and Delete removed this
                 pass (both deferred to future versions); Edit hidden once status is "saved_sent" */}
            {canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-3 font-mono text-[10px] uppercase tracking-wider"
              >
                <Pencil size={14} /> Edit
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}