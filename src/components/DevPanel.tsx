import { useState } from "react";
import { Settings2, X, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePermissions, type SectionKey } from "@/lib/permissions";
import { useAdmin } from "@/lib/admin";

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const { sections, toggleAccess } = usePermissions();
  const { admin, toggle: toggleAdmin } = useAdmin();
  const keys: SectionKey[] = ["journal", "observation", "mentor"];

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground shadow-lg"
        aria-label="Dev panel"
      >
        {open ? <X size={16} /> : <Settings2 size={16} />}
      </button>
      {open && (
        <div className="fixed bottom-32 right-4 z-50 w-64 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Dev · Permissions
          </p>
          <ul className="mt-3 space-y-2">
            {keys.map((k) => (
              <li key={k} className="flex items-center justify-between">
                <span className="text-sm capitalize">{sections[k].label}</span>
                <button
                  onClick={() => toggleAccess(k)}
                  className={`rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                    sections[k].hasAccess ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {sections[k].hasAccess ? "Granted" : "Locked"}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Dev · View
            </p>
            <button
              onClick={toggleAdmin}
              className={`mt-2 w-full rounded-md border border-border px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider ${
                admin ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              }`}
            >
              {admin ? "Admin view: ON" : "Admin view: OFF"}
            </button>
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Dev · Playground
            </p>
            <Link
              to="/playground/animations"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider hover:bg-accent"
            >
              <Sparkles size={11} /> Animations
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
