import { createFileRoute, Link, useRouter } from "@tanstack/react-router"; // <-- CHANGE: added useRouter
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { getGame } from "@/lib/games.functions";
import { getEntryForGame, saveDraft, savePrivate, saveAndSend } from "@/lib/entries.functions";
import { getJobForEntry } from "@/lib/reports.functions";
import { useAuth } from "@/lib/auth-context";
import { isPreviewUserId, previewMocks } from "@/lib/preview-mode";

export const Route = createFileRoute("/_authenticated/games/$gameId")({
  component: EntryEditor,
});

// <-- ADDITION: explicit Pacific-timezone formatting — .toLocaleString() with no
// arguments defaults to the browser's local timezone, which happens to work if the
// browser is set to Pacific but isn't guaranteed. Making it explicit here so the
// display always matches Pacific regardless of the viewer's own device settings.
function formatGameDate(iso: string | null) {
  if (!iso) return "no date";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function EntryEditor() {
  const { gameId } = Route.useParams();
  const { me } = useAuth();
  const router = useRouter(); // <-- ADDITION
  const isPreview = isPreviewUserId(me?.userId);
  const fetchGame = useServerFn(getGame);
  const fetchEntry = useServerFn(getEntryForGame);
  const fetchJob = useServerFn(getJobForEntry);
  const draftFn = useServerFn(saveDraft);
  const privFn = useServerFn(savePrivate);
  const sendFn = useServerFn(saveAndSend);
  const qc = useQueryClient();

  const game = useQuery({
    queryKey: ["game", gameId, isPreview],
    queryFn: isPreview ? async () => ({ game: previewMocks.game(gameId) }) : () => fetchGame({ data: { gameId } }),
  });
  const entry = useQuery({
    queryKey: ["entry", gameId, isPreview],
    queryFn: isPreview ? async () => ({ entry: previewMocks.entry(gameId) }) : () => fetchEntry({ data: { gameId } }),
  });

  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const defaultRecipientEmail = me?.profile?.default_recipient_email ?? null;
  const recipientToggledRef = useRef(false);
  const [useDefaultRecipient, setUseDefaultRecipient] = useState(!!defaultRecipientEmail);

  useEffect(() => {
    if (!recipientToggledRef.current) {
      setUseDefaultRecipient(!!defaultRecipientEmail);
    }
  }, [defaultRecipientEmail]);

  useEffect(() => {
    if (entry.data?.entry) {
      const body = (entry.data.entry.body as any) ?? {};
      setText(body.text ?? "");
      setRecipient(entry.data.entry.recipient_email ?? "");
      setStatus(entry.data.entry.status);
    }
  }, [entry.data?.entry?.id]);

  const job = useQuery({
    queryKey: ["job", entry.data?.entry?.id, isPreview],
    queryFn: isPreview
      ? async () => ({ job: { status: "sent", last_error: null } })
      : () => fetchJob({ data: { entryId: entry.data!.entry!.id } }),
    enabled: !!entry.data?.entry?.id && status === "saved_sent",
    refetchInterval: !isPreview && status === "saved_sent" ? 5000 : false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["entry", gameId] });
    qc.invalidateQueries({ queryKey: ["job"] });
  };

  // Autosave drafts every 5s when typing.
  useEffect(() => {
    if (isPreview || status && status !== "draft") return;
    const t = setTimeout(() => {
      if (text) draftFn({ data: { gameId, body: { text } } }).then(refresh).catch(() => {});
    }, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const onSavePrivate = async () => {
    setBusy(true);
    try {
      if (isPreview) { setStatus("saved_private"); router.navigate({ to: "/" }); return; } // <-- CHANGE: added navigate
      await privFn({ data: { gameId, body: { text } } });
      setStatus("saved_private");
      refresh();
      router.navigate({ to: "/" }); // <-- ADDITION
    } finally { setBusy(false); }
  };
  const onSaveSend = async () => {
    const resolvedRecipient = useDefaultRecipient ? defaultRecipientEmail : recipient;
    if (!resolvedRecipient) { alert("Enter recipient email"); return; }
    setBusy(true);
    try {
      if (isPreview) { setStatus("saved_sent"); router.navigate({ to: "/" }); return; } // <-- CHANGE: added navigate
      await sendFn({ data: { gameId, body: { text }, recipientEmail: resolvedRecipient } });
      setStatus("saved_sent");
      refresh();
      router.navigate({ to: "/" }); // <-- ADDITION
    } finally { setBusy(false); }
  };

  if (game.isLoading || entry.isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const g = game.data?.game;
  if (!g) return <p className="p-6">Not found. <Link to="/" className="underline">Home</Link></p>;

  return (
    <div className="px-4 py-6 space-y-4">
      <header>
        <Link to="/" className="text-xs text-muted-foreground">← Back</Link>
        <h1 className="mt-1 text-xl font-bold">{g.title}</h1>
        <p className="text-xs text-muted-foreground">
          {formatGameDate(g.game_date)}{g.opponent ? ` · vs ${g.opponent}` : ""} {/* <-- CHANGE: was raw {g.game_date ?? "no date"} */}
          {(g.gender || g.level) ? ` · ${[g.gender, g.level].filter(Boolean).join(" ")}` : ""}
        </p>
        {g.crew && <p className="text-xs text-muted-foreground">Crew: {g.crew}</p>}
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Your notes for this game…"
        rows={12}
        className="w-full rounded-lg border border-input bg-background p-3 text-sm font-mono"
        readOnly={status === "saved_sent"}
      />

      <div className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          id="useDefaultRecipient"
          checked={useDefaultRecipient}
          disabled={!defaultRecipientEmail || status === "saved_sent"}
          onChange={(e) => {
            recipientToggledRef.current = true;
            setUseDefaultRecipient(e.target.checked);
          }}
        />
        <label
          htmlFor="useDefaultRecipient"
          title={!defaultRecipientEmail ? "Set a default recipient in Settings first" : undefined}
        >
          Send to default recipient{defaultRecipientEmail ? ` (${defaultRecipientEmail})` : ""}
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Recipient email (for sending)</label>
        <input
          type="email"
          value={useDefaultRecipient ? "" : recipient} // <-- CHANGE: was always `recipient` — hid the stale typed value while default is in use, without touching the underlying state (so it reappears correctly if unchecked again)
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={useDefaultRecipient ? defaultRecipientEmail ?? "" : "recipient@example.com"} // <-- ADDITION: shows the default as a placeholder while checked, for clarity
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          readOnly={status === "saved_sent" || useDefaultRecipient}
          disabled={useDefaultRecipient}
        />
      </div>

      {status === "saved_sent" ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          Report saved & queued.
          {job.data?.job && (
            <span className="ml-1 font-medium">Status: {job.data.job.status}</span>
          )}
          {job.data?.job?.last_error && (
            <p className="mt-1 text-xs text-destructive">{job.data.job.last_error}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onSavePrivate} disabled={busy} className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50 hover:scale-105 active:scale-95 transition">
            Save & keep private
          </button>
          <button onClick={onSaveSend} disabled={busy} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50 hover:scale-105 active:scale-95 transition">
            Save & send report
          </button>
        </div>
      )}
      {status && status !== "saved_sent" && (
        <p className="text-xs text-muted-foreground">Status: {status}</p>
      )}
    </div>
  );
}