import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { excerpt, type FieldMatch, type Range, type SearchMode } from "@/lib/report-search";

export function SearchBox({
  value,
  onChange,
  placeholder,
  mode,
  shown,
  total,
  noun,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  mode: SearchMode;
  shown: number;
  total: number;
  noun: string;
}) {
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={`Search ${noun}`}
          className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {mode !== "all" && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {mode === "fuzzy" && shown > 0 ? "No exact matches — showing close matches · " : ""}
          {shown} of {total} {noun}
        </p>
      )}
    </div>
  );
}

export function NoMatches({ query, noun }: { query: string; noun: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      No {noun} match “{query.trim()}”.
    </div>
  );
}

export function Highlight({ text, ranges }: { text: string; ranges?: Range[] }) {
  if (!ranges || ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([s, e], i) => {
    if (s > at) parts.push(<span key={`t${i}`}>{text.slice(at, s)}</span>);
    parts.push(
      <mark key={`m${i}`} className="rounded-sm bg-primary/25 text-foreground">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < text.length) parts.push(<span key="rest">{text.slice(at)}</span>);
  return <>{parts}</>;
}

// One line per matched field that the card doesn't already display, e.g. "Crew: Smith, Jones".
// Fields listed in `onCard` are highlighted in place by the card itself.
export function MatchedFields({
  matches,
  onCard,
}: {
  matches: Record<string, FieldMatch>;
  onCard: string[];
}) {
  const extra = Object.values(matches).filter((m) => !onCard.includes(m.key));
  if (extra.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {extra.map((m) => {
        const cut = m.key === "notes" ? excerpt(m.value, m.ranges) : excerpt(m.value, m.ranges, 30, 60);
        return (
          <p key={m.key} className="line-clamp-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{m.label}: </span>
            <Highlight text={cut.text} ranges={cut.ranges} />
          </p>
        );
      })}
    </div>
  );
}
