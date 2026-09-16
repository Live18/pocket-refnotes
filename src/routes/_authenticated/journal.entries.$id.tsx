import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useServerFn } from "@tanstack/react-start";
import { getEntryById, savePrivate } from "@/lib/entries.functions";

export const Route = createFileRoute("/_authenticated/journal/entries/$id")({
  component: EntryDetail,
});

// <-- ADDITION: same explicit-timezone formatter used in _authenticated/index.tsx and
// games.$gameId.tsx, so this view's date matches the emailed report exactly, not just the browser's local time
function formatGameDate(iso: string | null) {
  if (!iso) return "no date";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "short",
    timeStyle: "short",
  });
}

type EntryDetailRow = {
  id: string;
  status: "draft" | "saved_private" | "saved_sent" | "send_failed";
  recipient_email: string | null;
  body: { text?: string } | null;
  saved_at: string | null;
  sent_at: string | null;
  updated_at: string;
  game: {
    id: string;
    title: string;
    game_date: string;
    location: string | null; // <-- ADDITION
    gender: string | null; // <-- ADDITION
    level: string | null; // <-- ADDITION
    crew: string | null; // <-- ADDITION
  } | null;
};

function statusLabel(status: EntryDetailRow["status"]) {
  if (status === "saved_sent") return "Sent";
  if (status === "saved_private") return "Saved";
  if (status === "send_failed") return "Send failed";
  return "Draft";
}

function EntryDetail() {
  const { id } = Route.useParams();
  const getEntryByIdFn = useServerFn(getEntryById);
  const savePrivateFn = useServerFn(savePrivate);

  const [entry, setEntry] = useState<EntryDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
          setBody(fetched?.body?.text ?? "");
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">Loading entry…</p>
      </div>
    );
  }

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

  const game = entry.game;

  const onSave = async () => {
    if (!game) return;
    try {
      setSaving(true);
      setSaveError(null);
      const result = await savePrivateFn({
        data: { gameId: game.id, body: { text: body } },
      });
      setEntry(result.entry as EntryDetailRow);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  const canEdit = entry.status !== "saved_sent";

  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title="Entry" />
      <div className="flex items-center justify-between px-5 pb-3">
        <Link to="/journal/entries" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          ← Archive
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-8">
        {saveError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {saveError}
          </div>
        )}

        {editing ? (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex-1 min-h-[260px] rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                onClick={onSave}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
              >
                <Save size={14} /> {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setEditing(false); setBody(entry.body?.text ?? ""); setSaveError(null); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-mono text-xs uppercase tracking-[0.2em]"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold leading-tight">{game?.title ?? "Untitled game"}</h2>

            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {game?.game_date && <span>{formatGameDate(game.game_date)}</span>} {/* <-- CHANGE: was new Date(game.game_date).toLocaleDateString() — now matches the email's exact Pacific-timezone formatting */}
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

            {/* <-- ADDITION: Location, Classification, Crew — mirrors buildReportEmailHtml's exact field set so this view matches what was actually emailed */}
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Location:</span> {game?.location ?? "—"}</p>
              {(game?.gender || game?.level) && (
                <p><span className="font-medium">Classification:</span> {[game?.gender, game?.level].filter(Boolean).join(" ")}</p>
              )}
              <p><span className="font-medium">Crew:</span> {game?.crew ?? "—"}</p>
            </div>

            <p className="whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">
              {entry.body?.text ?? ""}
            </p>

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