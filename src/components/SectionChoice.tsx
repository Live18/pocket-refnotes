import { Link } from "@tanstack/react-router";
import { Plus, FolderOpen } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

interface Props {
  title: string;
  newLabel?: string;
  openLabel?: string;
}

export function SectionChoice({ title, newLabel = "Create New Entry", openLabel = "Open Previous Entries" }: Props) {
  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title={title} />
      <div className="px-5 pb-4">
        <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-4 px-5 pb-8">
        <button
          className="flex flex-1 flex-col justify-between rounded-2xl border border-border bg-card p-6 text-left transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: "var(--shadow-tile-hero)" }}
        >
          <Plus size={28} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">New</p>
            <p className="text-2xl font-semibold leading-tight">{newLabel}</p>
          </div>
        </button>

        <button
          className="flex flex-1 flex-col justify-between rounded-2xl border border-border bg-muted p-6 text-left transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: "var(--shadow-tile)" }}
        >
          <FolderOpen size={28} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Archive</p>
            <p className="text-2xl font-semibold leading-tight">{openLabel}</p>
          </div>
        </button>
      </div>
    </div>
  );
}
