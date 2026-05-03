import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useJournal } from "@/lib/journal";

export const Route = createFileRoute("/journal/new")({
  component: NewJournal,
});

function NewJournal() {
  const { create } = useJournal();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const save = () => {
    if (!title.trim() && !body.trim()) return;
    const e = create({ title, body });
    navigate({ to: "/journal/entries/$id", params: { id: e.id } });
  };

  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title="New Entry" />
      <div className="px-5 pb-3">
        <Link to="/journal" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-5 pb-8">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="rounded-xl border border-border bg-card px-4 py-3 text-lg font-semibold outline-none focus:ring-1 focus:ring-ring"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your entry…"
          className="flex-1 min-h-[280px] rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={save}
          className="rounded-xl bg-primary px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
        >
          Save Entry
        </button>
      </div>
    </div>
  );
}
