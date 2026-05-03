import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Mic, Save, Send, Pencil, Trash2, Check, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useJournal, type GameMeta } from "@/lib/journal";

export const Route = createFileRoute("/journal/new")({
  component: NewJournal,
});

type FieldKey = keyof GameMeta;

interface FieldDef {
  key: FieldKey;
  label: string;
  prompt: string;
  type: "datetime-local" | "text";
  placeholder?: string;
}

const FIELDS: FieldDef[] = [
  { key: "gameDateTime", label: "Game date & time", prompt: "When was the game?", type: "datetime-local" },
  { key: "venue", label: "Venue", prompt: "Where was the game played?", type: "text", placeholder: "e.g. Lincoln HS Gym" },
  { key: "homeTeam", label: "Home team", prompt: "Who was the home team?", type: "text", placeholder: "Home team name" },
  { key: "visitingTeam", label: "Visiting team", prompt: "Who was the visiting team?", type: "text", placeholder: "Visiting team name" },
  { key: "crew", label: "Crew", prompt: "Who else was on your crew?", type: "text", placeholder: "Names, comma separated" },
];

const EMPTY: GameMeta = { gameDateTime: "", venue: "", homeTeam: "", visitingTeam: "", crew: "" };

type Stage = "fields" | "review" | "notes";

function NewJournal() {
  const { create } = useJournal();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("fields");
  const [stepIdx, setStepIdx] = useState(0);
  const [meta, setMeta] = useState<GameMeta>(EMPTY);

  // Notes stage
  const [body, setBody] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [recipients, setRecipients] = useState("");

  const field = FIELDS[stepIdx];
  const fieldValue = meta[field?.key];

  const setField = (k: FieldKey, v: string) => setMeta((m) => ({ ...m, [k]: v }));

  const advance = () => {
    if (!fieldValue.trim()) return;
    if (stepIdx < FIELDS.length - 1) setStepIdx(stepIdx + 1);
    else setStage("review");
  };

  const goBack = () => {
    if (stage === "fields") {
      if (stepIdx > 0) setStepIdx(stepIdx - 1);
      else navigate({ to: "/journal" });
    } else if (stage === "review") {
      setStage("fields");
      setStepIdx(FIELDS.length - 1);
    } else if (stage === "notes") {
      setStage("review");
    }
  };

  const resetAll = () => {
    if (!confirm("Delete all entered info and start over?")) return;
    setMeta(EMPTY);
    setStepIdx(0);
    setStage("fields");
    setBody("");
  };

  const editField = (idx: number) => {
    setStepIdx(idx);
    setStage("fields");
  };

  const title = useMemo(() => {
    if (!meta.homeTeam && !meta.visitingTeam) return "Game notes";
    return `${meta.visitingTeam || "?"} @ ${meta.homeTeam || "?"}`;
  }, [meta]);

  const save = (share: boolean) => {
    const recList = share
      ? recipients.split(",").map((r) => r.trim()).filter(Boolean)
      : undefined;
    const e = create({ title, body, game: meta, notifyRecipients: recList, share });
    navigate({ to: "/journal/entries/$id", params: { id: e.id } });
  };

  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title={stage === "notes" ? "Notes" : "New Entry"} />

      <div className="flex items-center justify-between px-5 pb-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <Link to="/journal" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          Cancel
        </Link>
      </div>

      {stage === "fields" && (
        <FieldStep
          field={field}
          value={fieldValue}
          onChange={(v) => setField(field.key, v)}
          onNext={advance}
          stepIdx={stepIdx}
          total={FIELDS.length}
        />
      )}

      {stage === "review" && (
        <ReviewStep
          meta={meta}
          onEdit={editField}
          onConfirm={() => setStage("notes")}
          onDelete={resetAll}
        />
      )}

      {stage === "notes" && (
        <NotesStep
          title={title}
          meta={meta}
          body={body}
          setBody={setBody}
          shareOpen={shareOpen}
          setShareOpen={setShareOpen}
          recipients={recipients}
          setRecipients={setRecipients}
          onSave={() => save(false)}
          onSaveShare={() => save(true)}
        />
      )}
    </div>
  );
}

function FieldStep({
  field, value, onChange, onNext, stepIdx, total,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  stepIdx: number;
  total: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-1 flex-col gap-6 px-5 pb-8">
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= stepIdx ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Step {stepIdx + 1} of {total} · {field.label}
        </p>
        <h2 className="text-2xl font-semibold leading-tight">{field.prompt}</h2>

        <input
          ref={inputRef}
          autoFocus
          type={field.type}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onNext(); }}
          className="mt-2 rounded-xl border border-border bg-card px-4 py-4 text-lg outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <button
        onClick={onNext}
        disabled={!value.trim()}
        className="rounded-xl bg-primary px-4 py-4 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-40"
      >
        {stepIdx === total - 1 ? "Review" : "Next"}
      </button>
    </div>
  );
}

function ReviewStep({
  meta, onEdit, onConfirm, onDelete,
}: {
  meta: GameMeta;
  onEdit: (idx: number) => void;
  onConfirm: () => void;
  onDelete: () => void;
}) {
  const fmt = (f: FieldDef) => {
    const v = meta[f.key];
    if (!v) return "—";
    if (f.type === "datetime-local") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? v : d.toLocaleString();
    }
    return v;
  };
  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Review</p>
        <h2 className="text-2xl font-semibold leading-tight">Confirm game info</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tap any field to edit.</p>
      </div>

      <div className="flex flex-col gap-2">
        {FIELDS.map((f, idx) => (
          <button
            key={f.key}
            onClick={() => onEdit(idx)}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-accent/40"
          >
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{f.label}</p>
              <p className="mt-1 truncate text-base">{fmt(f)}</p>
            </div>
            <Pencil size={16} className="mt-1 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <button
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-destructive"
        >
          <Trash2 size={14} /> Delete
        </button>
        <button
          onClick={onConfirm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-primary-foreground"
        >
          <Check size={14} /> Confirm
        </button>
      </div>
    </div>
  );
}

function NotesStep({
  title, meta, body, setBody,
  shareOpen, setShareOpen, recipients, setRecipients,
  onSave, onSaveShare,
}: {
  title: string;
  meta: GameMeta;
  body: string;
  setBody: (v: string) => void;
  shareOpen: boolean;
  setShareOpen: (b: boolean) => void;
  recipients: string;
  setRecipients: (v: string) => void;
  onSave: () => void;
  onSaveShare: () => void;
}) {
  const [doneOpen, setDoneOpen] = useState(false);

  const onMicTap = () => {
    alert("Voice notes are not connected yet.\n\nThis feature will use Groq Whisper Large v3 Turbo via your local server.");
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-5 pb-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Notes</p>
        <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
        {meta.gameDateTime && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {new Date(meta.gameDateTime).toLocaleString()} · {meta.venue}
          </p>
        )}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your notes…"
        className="flex-1 min-h-[260px] rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring"
      />

      {shareOpen && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Notify recipients (admin view link)
          </p>
          <input
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="email1@example.com, email2@example.com"
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Recipients receive a notification only — they view notes in the admin view.
          </p>
        </div>
      )}

      {doneOpen && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <button
            onClick={onSave}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
          >
            <Save size={14} /> Save
          </button>
          <button
            onClick={() => { setShareOpen(true); setDoneOpen(false); }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-mono text-xs uppercase tracking-[0.2em]"
          >
            <Send size={14} /> Save &amp; Share
          </button>
        </div>
      )}

      {shareOpen && (
        <button
          onClick={onSaveShare}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
        >
          <Send size={14} /> Send notification &amp; save
        </button>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onMicTap}
          aria-label="Voice note (3 min) — not connected"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          title="Voice notes not connected (Groq Whisper Large v3 Turbo)"
        >
          <Mic size={14} /> Voice (3 min) · Off
        </button>
        <button
          onClick={() => setDoneOpen((o) => !o)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-background"
        >
          <Check size={14} /> All Done
        </button>
      </div>
    </div>
  );
}
