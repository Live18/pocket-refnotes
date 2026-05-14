import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getGame } from "@/lib/games.functions";
import { getEntryForGame, saveDraft, savePrivate, saveAndSend } from "@/lib/entries.functions";
import { getJobForEntry } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/games/$gameId")({
  component: EntryEditor,
});

function EntryEditor() {
  const { gameId } = Route.useParams();
  const fetchGame = useServerFn(getGame);
  const fetchEntry = useServerFn(getEntryForGame);
  const fetchJob = useServerFn(getJobForEntry);
  const draftFn = useServerFn(saveDraft);
  const privFn = useServerFn(savePrivate);
  const sendFn = useServerFn(saveAndSend);
  const qc = useQueryClient();

  const game = useQuery({ queryKey: ["game", gameId], queryFn: () => fetchGame({ data: { gameId } }) });
  const entry = useQuery({ queryKey: ["entry", gameId], queryFn: () => fetchEntry({ data: { gameId } }) });

  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (entry.data?.entry) {
      const body = (entry.data.entry.body as any) ?? {};
      setText(body.text ?? "");
      setRecipient(entry.data.entry.recipient_email ?? "");
      setStatus(entry.data.entry.status);
    }
  }, [entry.data?.entry?.id]);

  const job = useQuery({
    queryKey: ["job", entry.data?.entry?.id],
    queryFn: () => fetchJob({ data: { entryId: entry.data!.entry!.id } }),
    enabled: !!entry.data?.entry?.id && status === "saved_sent",
    refetchInterval: status === "saved_sent" ? 5000 : false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["entry", gameId] });
    qc.invalidateQueries({ queryKey: ["job"] });
  };

  // Autosave drafts every 5s when typing.
  useEffect(() => {
    if (status === "saved_sent") return;
    const t = setTimeout(() => {
      if (text) draftFn({ data: { gameId, body: { text } } }).then(refresh).catch(() => {});
    }, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const onSavePrivate = async () => {
    setBusy(true);
    try { await privFn({ data: { gameId, body: { text } } }); setStatus("saved_private"); refresh(); }
    finally { setBusy(false); }
  };
  const onSaveSend = async () => {
    if (!recipient) { alert("Enter recipient email"); return; }
    setBusy(true);
    try {
      await sendFn({ data: { gameId, body: { text }, recipientEmail: recipient } });
      setStatus("saved_sent"); refresh();
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
        <p className="text-xs text-muted-foreground">{g.game_date ?? "no date"}{g.opponent ? ` · vs ${g.opponent}` : ""}</p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Your notes for this game…"
        rows={12}
        className="w-full rounded-lg border border-input bg-background p-3 text-sm font-mono"
        readOnly={status === "saved_sent"}
      />

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Recipient email (for sending)</label>
        <input
          type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)}
          placeholder="recipient@example.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          readOnly={status === "saved_sent"}
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
