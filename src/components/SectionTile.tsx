import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Lock } from "lucide-react";
import type { SectionData } from "@/lib/permissions";

interface Props {
  section: SectionData;
  to: "/journal" | "/observation" | "/mentor";
  variant?: "hero" | "stack";
}

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function SectionTile({ section, to, variant = "stack" }: Props) {
  const isHero = variant === "hero";
  const disabled = !section.hasAccess;

  const base = `relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border p-5 transition-all ${
    isHero ? "min-h-[280px]" : "min-h-[132px]"
  }`;

  if (disabled) {
    return (
      <div
        className={`${base} cursor-not-allowed bg-muted text-muted-foreground`}
        aria-disabled="true"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">{section.label}</span>
          <Lock size={16} />
        </div>
        <p className={`${isHero ? "text-xl" : "text-sm"} font-semibold leading-tight`}>
          Not Available Right Now
        </p>
      </div>
    );
  }

  return (
    <Link
      to={to}
      className={`${base} bg-card text-card-foreground hover:-translate-y-0.5`}
      style={{ boxShadow: isHero ? "var(--shadow-tile-hero)" : "var(--shadow-tile)" }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {section.label}
        </span>
        <ArrowUpRight size={isHero ? 20 : 16} />
      </div>

      <div className="space-y-2">
        {section.key === "mentor" && section.mentorUnread ? (
          <p className="font-mono text-[11px] uppercase tracking-wider text-foreground">
            {section.mentorUnread} new response{section.mentorUnread > 1 ? "s" : ""}
          </p>
        ) : null}

        <div className={`flex items-baseline gap-2 ${isHero ? "text-5xl" : "text-3xl"} font-semibold`}>
          <span className="font-mono">{section.entryCount}</span>
          <span className="text-xs font-normal text-muted-foreground">entries</span>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Last · {formatDate(section.lastEntry)}
        </p>
      </div>
    </Link>
  );
}
