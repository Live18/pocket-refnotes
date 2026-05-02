import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function AppHeader({ title = "RefNotes" }: { title?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Today</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}
