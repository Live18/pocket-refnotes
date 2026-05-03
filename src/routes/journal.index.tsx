import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, FolderOpen } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/journal/")({
  component: JournalChoice,
});

function JournalChoice() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title="Journal" />
      <div className="px-5 pb-4">
        <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-4 px-5 pb-8">
        <button
          onClick={() => navigate({ to: "/journal/new" })}
          className="flex flex-1 flex-col justify-between rounded-2xl border border-border bg-card p-6 text-left transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: "var(--shadow-tile-hero)" }}
        >
          <Plus size={28} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">New</p>
            <p className="text-2xl font-semibold leading-tight">New Journal Entry</p>
          </div>
        </button>

        <button
          onClick={() => navigate({ to: "/journal/entries" })}
          className="flex flex-1 flex-col justify-between rounded-2xl border border-border bg-muted p-6 text-left transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: "var(--shadow-tile)" }}
        >
          <FolderOpen size={28} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Archive</p>
            <p className="text-2xl font-semibold leading-tight">Open Previous Journals</p>
          </div>
        </button>
      </div>
    </div>
  );
}
