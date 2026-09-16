import { Link, useLocation } from "@tanstack/react-router";
import { Home, BookOpen, Eye, Users } from "lucide-react";
import { useState } from "react"; // <-- ADDITION: tracks which "coming soon" modal is open

// <-- CHANGE: Observe and Mentor no longer have a `to` — they're `comingSoon` buttons
// that open a modal instead of navigating. Journal's `to` changed from "/journal" to
// "/journal/entries" (the real Archive list — "/journal" isn't where past entries live).
const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/journal/entries", label: "Journal", icon: BookOpen }, // <-- CHANGE: was "/journal"
  { label: "Observe", icon: Eye, comingSoon: true }, // <-- CHANGE: was a Link to "/observation"
  { label: "Mentor", icon: Users, comingSoon: true }, // <-- CHANGE: was a Link to "/mentor"
] as const;

export function BottomTabBar() {
  const { pathname } = useLocation();
  const [comingSoonOpen, setComingSoonOpen] = useState<string | null>(null); // <-- ADDITION

  return (
    <>
      <nav className="sticky bottom-0 left-0 right-0 border-t border-border bg-card/95 px-2 py-2 backdrop-blur">
        <ul className="grid grid-cols-4">
          {tabs.map((tab) => {
            const { label, icon: Icon } = tab;

            // <-- ADDITION: "coming soon" tabs render a button + modal, not a Link
            if ("comingSoon" in tab && tab.comingSoon) {
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => setComingSoonOpen(label)}
                    className="flex w-full flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Icon size={18} strokeWidth={1.75} />
                    {label}
                  </button>
                </li>
              );
            }

            const active = pathname === tab.to;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-mono uppercase tracking-widest transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* <-- ADDITION: temporary "coming soon" modal, per Sep 9 decision — keep both
           tabs visible, but don't link anywhere real yet */}
      {comingSoonOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setComingSoonOpen(null)}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-border bg-card p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm">{comingSoonOpen} is in production and will be available soon.</p>
            <button
              type="button"
              onClick={() => setComingSoonOpen(null)}
              className="mt-4 w-full rounded-md border border-input bg-background px-4 py-2 text-sm transition hover:scale-105 active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}