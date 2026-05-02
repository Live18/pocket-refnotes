import { Link, useLocation } from "@tanstack/react-router";
import { Home, BookOpen, Eye, Users } from "lucide-react";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/observation", label: "Observe", icon: Eye },
  { to: "/mentor", label: "Mentor", icon: Users },
] as const;

export function BottomTabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="sticky bottom-0 left-0 right-0 border-t border-border bg-card/95 px-2 py-2 backdrop-blur">
      <ul className="grid grid-cols-4">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link
                to={to}
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
  );
}
