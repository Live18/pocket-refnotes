import { Moon, Sun, Settings } from "lucide-react"; // <-- CHANGE: added Settings icon
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context"; // <-- ADDITION
import { isPreviewUserId } from "@/lib/preview-mode"; // <-- ADDITION (unused directly here, but getCapacities/ViewingBadge depend on auth state the same way HomePage used it)
import { getCapacities } from "@/lib/permissions"; // <-- ADDITION
import { ViewingBadge } from "@/components/ViewingBadge"; // <-- ADDITION
import { Link } from "@tanstack/react-router"; // <-- ADDITION

export function AppHeader({ title = "RefNotes" }: { title?: string }) {
  const { theme, toggle } = useTheme();
  const { me, signOut } = useAuth(); // <-- ADDITION

  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Today</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {/* <-- ADDITION: Welcome line, matches HomePage's previous inline header */}
        <p className="text-xs text-muted-foreground">Welcome, {me?.profile?.display_name || me?.email}</p>
      </div>
      <div className="flex items-center gap-2"> {/* <-- ADDITION: wraps all right-side controls, was just the theme button before */}
        <ViewingBadge />
        {getCapacities(me).includes("admin") && (
          <Link to="/admin" className="rounded-md border border-border px-3 py-1.5 text-xs">Admin</Link>
        )}
        <Link
          to="/journal/settings"
          className="flex items-center rounded-md border border-border px-2 py-1.5"
          aria-label="Settings"
        >
          <Settings size={14} />
        </Link>
        <button onClick={signOut} className="rounded-md border border-border px-3 py-1.5 text-xs">Sign out</button>
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}