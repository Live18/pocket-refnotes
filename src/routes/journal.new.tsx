import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react"; // <-- CHANGE: added useEffect (state-sync fix)
import { Mic, Save, Send, Pencil, Trash2, Check, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import type { GameMeta } from "@/lib/journal";
import { useServerFn } from "@tanstack/react-start";
import { createGame } from "@/lib/games.functions";
import { savePrivate, saveAndSend } from "@/lib/entries.functions";
import { useAuth } from "@/lib/auth-context"; // <-- ADDITION: need me.profile.default_recipient_email

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
  const { me } = useAuth(); // <-- ADDITION
  const createGameFn = useServerFn(createGame);
  const savePrivateFn = useServerFn(savePrivate);
  const saveAndSendFn = useServerFn(saveAndSend);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [stage, setStage] = useState<Stage>("fields");
  const [stepIdx, setStepIdx] = useState(0);
  const [meta, setMeta] = useState<GameMeta>(EMPTY);

  // Notes stage
  const [body, setBody] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [recipients, setRecipients] = useState("");

  const defaultRecipientEmail = me?.profile?.default_recipient_email ?? null; // <-- ADDITION
  // <-- ADDITION: pre-checked when a default exists (per Bill's decision, Sep 8); unchecked
  // and disabled otherwise.
  const [useDefaultRecipient, setUseDefaultRecipient] = useState(!!defaultRecipientEmail);
  // <-- ADDITION: tracks whether the referee has manually toggled the checkbox this
  // session, so an unrelated defaultRecipientEmail change (e.g. context refresh after
  // visiting Settings elsewhere) doesn't silently override a deliberate manual choice.
  const userTouchedDefaultCheckboxRef = useRef(false);

  // <-- ADDITION: keeps the checkbox in sync with defaultRecipientEmail if it changes
  // after this component mounted — but only while the referee hasn't manually touched
  // it themselves this session (see ref above).
  useEffect(() => {
    if (!userTouchedDefaultCheckboxRef.current) {
      setUseDefaultRecipient(!!defaultRecipientEmail);
    }
  }, [defaultRecipientEmail]);

  // <-- ADDITION: wraps the raw setter so manual checkbox interaction is flagged before
  // updating state — passed to NotesStep instead of setUseDefaultRecipient directly.
  const handleUseDefaultRecipientChange = (checked: boolean) => {
    userTouchedDefaultCheckboxRef.current = true;
    setUseDefaultRecipient(checked);
  };

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

    const save = async (share: boolean) => {
    setError(null);
    // <-- CHANGE: when the default-recipient checkbox is checked and a default exists,
    // use that instead of parsing the manual `recipients` field. Falls back to the
    // original manual-entry parsing otherwise — unchanged behavior for anyone without
    // a default set, or who unchecked the box.
    const recipientEmail = share
      ? (useDefaultRecipient && defaultRecipientEmail
          ? defaultRecipientEmail
          : recipients.split(",").map((r) => r.trim()).filter(Boolean)[0])
      : undefined;
    if (share && !recipientEmail) {
      setError("Enter an email address to share this report.");
      return;
    }

    setSaving(true);
    try {
      const { game } = await createGameFn({
        data: {
          title,
          gameDate: meta.gameDateTime || null,
          opponent: meta.visitingTeam || null,
          location: meta.venue || null,
	  crew: meta.crew || null,
        },
      });

      const { entry } = share
        ? await saveAndSendFn({
            data: { gameId: game.id, body: { notes: body }, recipientEmail: recipientEmail! },
          })
        : await savePrivateFn({
            data: { gameId: game.id, body: { notes: body } },
          });

      navigate({ to: "/journal/entries/$id", params: { id: entry.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving this entry.");
    } finally {
      setSaving(false);
    }
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
	  error={error}
          saving={saving}
          defaultRecipientEmail={defaultRecipientEmail} // <-- ADDITION
          useDefaultRecipient={useDefaultRecipient} // <-- ADDITION
          setUseDefaultRecipient={handleUseDefaultRecipientChange} // <-- ADDITION (wrapped setter, not the raw one)
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
  onSave, onSaveShare, error, saving,
  defaultRecipientEmail, useDefaultRecipient, setUseDefaultRecipient, // <-- ADDITION
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
  error: string | null;
  saving: boolean;
  defaultRecipientEmail: string | null; // <-- ADDITION
  useDefaultRecipient: boolean; // <-- ADDITION
  setUseDefaultRecipient: (b: boolean) => void; // <-- ADDITION
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
      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
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

          {/* <-- ADDITION: default-recipient checkbox. Disabled + unchecked when the
               referee has no default set; checked by default and greys out the manual
               field when a default exists. */}
          <label
            className={`mt-2 flex items-center gap-2 text-sm ${!defaultRecipientEmail ? "text-muted-foreground opacity-60" : ""}`}
            title={!defaultRecipientEmail ? "Set a default recipient in Settings to use this" : undefined}
          >
            <input
              type="checkbox"
              checked={useDefaultRecipient}
              disabled={!defaultRecipientEmail}
              onChange={(e) => setUseDefaultRecipient(e.target.checked)}
            />
            Send to default recipient
            {defaultRecipientEmail && (
              <span className="text-muted-foreground">({defaultRecipientEmail})</span>
            )}
          </label>

          <input
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="email1@example.com"
            disabled={useDefaultRecipient && !!defaultRecipientEmail} // <-- ADDITION: greyed out while default is in use
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-50" // <-- CHANGE: added disabled:opacity-50
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            The recipient receives a notification only — they view notes in the admin view.
          </p>
        </div>
      )}

      {doneOpen && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <button
            onClick={onSave}
	    disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
          >
            <Save size={14} /> Save
          </button>
          <button
            onClick={() => { setShareOpen(true); setDoneOpen(false); }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-mono text-xs uppercase tracking-[0.2em]"
          >
            <Send size={14} /> Save &amp; Send {/* <-- CHANGE: was "Save & Share" */}
          </button>
        </div>
      )}

      {shareOpen && (
        <button
          onClick={onSaveShare}
	  disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
        >
          <Send size={14} /> Send &amp; Save
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