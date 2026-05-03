import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
  editedAt?: string; // ISO of last user edit (after creation)
  sharedAt?: string; // ISO when first shared with mentor; undefined = never shared
}

const STORAGE_KEY = "refnotes.journal.v1";

const seed = (): JournalEntry[] => {
  const now = Date.now();
  const day = 86400_000;
  const mk = (i: number, over: Partial<JournalEntry>): JournalEntry => ({
    id: crypto.randomUUID(),
    title: `Entry ${i}`,
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    tags: [],
    createdAt: new Date(now - i * day).toISOString(),
    updatedAt: new Date(now - i * day).toISOString(),
    ...over,
  });
  return [
    mk(1, { title: "Morning reflection", tags: ["reflection"], sharedAt: new Date(now - 0.5 * day).toISOString() }),
    mk(3, { title: "Practice notes", tags: ["practice"], editedAt: new Date(now - 2 * day).toISOString() }),
    mk(7, { title: "Weekly review" }),
  ];
};

interface Ctx {
  entries: JournalEntry[];
  get: (id: string) => JournalEntry | undefined;
  create: (data: { title: string; body: string; tags?: string[] }) => JournalEntry;
  update: (id: string, patch: Partial<Pick<JournalEntry, "title" | "body" | "tags">>) => void;
  remove: (ids: string[]) => void;
  setShared: (ids: string[], shared: boolean) => void;
  addTag: (ids: string[], tag: string) => void;
}

const JournalContext = createContext<Ctx | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    const s = seed();
    return s;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  }, [entries]);

  const value = useMemo<Ctx>(() => ({
    entries: [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    get: (id) => entries.find((e) => e.id === id),
    create: ({ title, body, tags = [] }) => {
      const now = new Date().toISOString();
      const entry: JournalEntry = {
        id: crypto.randomUUID(),
        title: title || "Untitled",
        body,
        tags,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => [entry, ...prev]);
      return entry;
    },
    update: (id, patch) => {
      const now = new Date().toISOString();
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: now, editedAt: now } : e)),
      );
    },
    remove: (ids) => {
      const set = new Set(ids);
      setEntries((prev) => prev.filter((e) => !set.has(e.id)));
    },
    setShared: (ids, shared) => {
      const set = new Set(ids);
      const now = new Date().toISOString();
      setEntries((prev) =>
        prev.map((e) =>
          set.has(e.id) ? { ...e, sharedAt: shared ? e.sharedAt ?? now : undefined } : e,
        ),
      );
    },
    addTag: (ids, tag) => {
      const t = tag.trim();
      if (!t) return;
      const set = new Set(ids);
      setEntries((prev) =>
        prev.map((e) =>
          set.has(e.id) && !e.tags.includes(t) ? { ...e, tags: [...e.tags, t] } : e,
        ),
      );
    },
  }), [entries]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used inside JournalProvider");
  return ctx;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}
