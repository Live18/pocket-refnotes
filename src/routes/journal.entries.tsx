import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, Share2, Tag, Download, Printer, X, CheckSquare, Square } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useJournal, timeAgo, type JournalEntry } from "@/lib/journal";

export const Route = createFileRoute("/journal/entries")({
  component: EntriesList,
});

function EntriesList() {
  const { entries, remove, setShared, addTag } = useJournal();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagPrompt, setTagPrompt] = useState(false);
  const [tagValue, setTagValue] = useState("");

  const selectMode = selected.size > 0;
  const selectedIds = Array.from(selected);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clear = () => setSelected(new Set());

  const onDelete = () => {
    if (!confirm(`Delete ${selectedIds.length} entr${selectedIds.length === 1 ? "y" : "ies"}?`)) return;
    remove(selectedIds);
    clear();
  };

  const onShareToggle = (shared: boolean) => {
    setShared(selectedIds, shared);
    clear();
  };

  const onTag = () => {
    if (!tagValue.trim()) return;
    addTag(selectedIds, tagValue);
    setTagValue("");
    setTagPrompt(false);
    clear();
  };

  const exportSelected = () => {
    const data = entries.filter((e) => selected.has(e.id));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printSelected = () => {
    const data = entries.filter((e) => selected.has(e.id));
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Journal Export</title>
      <style>body{font-family:system-ui;padding:32px;max-width:680px;margin:auto;color:#111}
      article{border-bottom:1px solid #ddd;padding:16px 0;page-break-inside:avoid}
      h2{margin:0 0 4px}small{color:#666}p{white-space:pre-wrap}</style></head><body>
      <h1>Journal Entries</h1>
      ${data.map((e) => `
        <article>
          <h2>${escapeHtml(e.title)}</h2>
          <small>Created ${new Date(e.createdAt).toLocaleString()}${e.editedAt ? ` · Edited ${new Date(e.editedAt).toLocaleString()}` : ""}${e.sharedAt ? ` · Shared ${new Date(e.sharedAt).toLocaleString()}` : " · Never shared"}</small>
          <p>${escapeHtml(e.body)}</p>
          ${e.tags.length ? `<small>Tags: ${e.tags.map(escapeHtml).join(", ")}</small>` : ""}
        </article>`).join("")}
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title="Journal Archive" />
      <div className="flex items-center justify-between px-5 pb-3">
        <Link to="/journal" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>

      {selectMode && (
        <div className="mx-5 mb-3 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2">
          <button onClick={clear} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
            <X size={14} /> {selected.size} selected
          </button>
          <div className="flex items-center gap-1">
            <IconBtn label="Share" onClick={() => onShareToggle(true)}><Share2 size={14} /></IconBtn>
            <IconBtn label="Unshare" onClick={() => onShareToggle(false)}><Share2 size={14} className="opacity-50" /></IconBtn>
            <IconBtn label="Tag" onClick={() => setTagPrompt(true)}><Tag size={14} /></IconBtn>
            <IconBtn label="Export" onClick={exportSelected}><Download size={14} /></IconBtn>
            <IconBtn label="Print" onClick={printSelected}><Printer size={14} /></IconBtn>
            <IconBtn label="Delete" onClick={onDelete} danger><Trash2 size={14} /></IconBtn>
          </div>
        </div>
      )}

      {tagPrompt && (
        <div className="mx-5 mb-3 flex gap-2 rounded-xl border border-border bg-card p-3">
          <input
            autoFocus
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onTag()}
            placeholder="Tag name"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none"
          />
          <button onClick={onTag} className="rounded-md bg-primary px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-primary-foreground">
            Apply
          </button>
        </div>
      )}

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
            selected={selected.has(e.id)}
            selectMode={selectMode}
            onToggle={() => toggle(e.id)}
            onOpen={() => navigate({ to: "/journal/entries/$id", params: { id: e.id } })}
          />
        ))}
      </ul>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-md border border-border ${
        danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function EntryRow({
  entry,
  selected,
  selectMode,
  onToggle,
  onOpen,
}: {
  entry: JournalEntry;
  selected: boolean;
  selectMode: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <li
      onClick={() => (selectMode ? onToggle() : onOpen())}
      className={`flex gap-3 rounded-xl border border-border p-4 transition-colors ${
        selected ? "bg-accent" : "bg-card hover:bg-accent/50"
      }`}
      style={{ boxShadow: "var(--shadow-tile)" }}
    >
      <button
        onClick={(ev) => { ev.stopPropagation(); onToggle(); }}
        aria-label={selected ? "Deselect" : "Select"}
        className="mt-1 grid h-5 w-5 place-items-center text-muted-foreground"
      >
        {selected ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base font-semibold">{entry.title}</h3>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {timeAgo(entry.createdAt)}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.body}</p>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {entry.editedAt && <span>Edited {timeAgo(entry.editedAt)}</span>}
          {entry.sharedAt ? (
            <span className="text-foreground">Shared {timeAgo(entry.sharedAt)}</span>
          ) : (
            <span className="opacity-70">Never shared</span>
          )}
          {entry.tags.map((t) => (
            <span key={t} className="rounded-sm border border-border px-1.5 py-0.5 normal-case tracking-normal">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
