import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Share2, Trash2, Save, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useJournal, timeAgo } from "@/lib/journal";

export const Route = createFileRoute("/journal/entries/$id")({
  component: EntryDetail,
});

function EntryDetail() {
  const { id } = Route.useParams();
  const { get, update, remove, setShared } = useJournal();
  const navigate = useNavigate();
  const entry = get(id);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");

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

  const onSave = () => {
    update(entry.id, { title, body });
    setEditing(false);
  };

  const onDelete = () => {
    if (!confirm("Delete this entry?")) return;
    remove([entry.id]);
    navigate({ to: "/journal/entries" });
  };

  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title="Entry" />
      <div className="flex items-center justify-between px-5 pb-3">
        <Link to="/journal/entries" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          ← Archive
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-8">
        {editing ? (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border border-border bg-card px-4 py-3 text-lg font-semibold outline-none focus:ring-1 focus:ring-ring"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex-1 min-h-[260px] rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                onClick={onSave}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
              >
                <Save size={14} /> Save
              </button>
              <button
                onClick={() => { setEditing(false); setTitle(entry.title); setBody(entry.body); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-mono text-xs uppercase tracking-[0.2em]"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold leading-tight">{entry.title}</h2>

            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Created {timeAgo(entry.createdAt)}</span>
              {entry.editedAt && <span>· Edited {timeAgo(entry.editedAt)}</span>}
              {entry.sharedAt ? (
                <span className="text-foreground">· Shared {timeAgo(entry.sharedAt)}</span>
              ) : (
                <span>· Never shared</span>
              )}
            </div>

            {entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {entry.tags.map((t) => (
                  <span key={t} className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px]">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            <p className="whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">
              {entry.body}
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-3 font-mono text-[10px] uppercase tracking-wider"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={() => setShared([entry.id], !entry.sharedAt)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-3 font-mono text-[10px] uppercase tracking-wider"
              >
                <Share2 size={14} /> {entry.sharedAt ? "Unshare" : "Share"}
              </button>
              <button
                onClick={onDelete}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-destructive"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
