// Client-side keyword search shared by the Journal home (games) and Journal Archive (reports) lists.
//
// Matching rules:
// - Case- and accent-insensitive ("Ramirez" finds "Ramírez"); every typed word must match somewhere in the item (any field, any order).
// - Punctuation and spaces inside a word are ignored, so "handcheck" finds "hand-check" and "hand check".
// - Exact pass first. Only if it finds nothing do we fall back to a typo-tolerant pass, where a word
//   may be a letter or two off (missing, extra, wrong, or two letters swapped).

export function entryStatusLabel(status: string) {
  if (status === "saved_sent") return "Sent";
  if (status === "saved_private") return "Saved";
  if (status === "send_failed") return "Send failed";
  return "Draft";
}

export type SearchField = {
  key: string;
  label: string;
  value: string | null | undefined;
};

export type Range = [start: number, end: number];

export type FieldMatch = {
  key: string;
  label: string;
  value: string;
  ranges: Range[];
};

export type SearchResult<T> = {
  item: T;
  matches: Record<string, FieldMatch>;
  score: number;
};

export type SearchMode = "all" | "exact" | "fuzzy";

export type SearchOutcome<T> = {
  mode: SearchMode;
  results: SearchResult<T>[];
};

const WORD_CHAR = /[\p{L}\p{N}]/u;
// Includes combining marks so a word typed with decomposed accents isn't split in two.
const WORD_RUN = /[\p{L}\p{N}\p{M}]+/gu;

// Lowercase and drop accents, so "Ramirez" matches "Ramírez" exactly (and vice versa).
function fold(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

// Folded letters/digits only, with a map from each kept char back to its index in the original string.
function compact(s: string) {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    for (const piece of fold(s[i])) {
      if (!WORD_CHAR.test(piece)) continue;
      text += piece;
      map.push(i);
    }
  }
  return { text, map };
}

export function queryTerms(query: string) {
  return query
    .split(/\s+/)
    .map((t) => compact(t).text)
    .filter(Boolean);
}

// Typos allowed for a word of this length. Short words must match exactly or they'd match everything.
function allowedTypos(length: number) {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

// Optimal string alignment distance: insert, delete, substitute, or swap two adjacent letters.
function typoDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push(new Array(b.length + 1).fill(0));
    rows[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = d;
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return max + 1;
  }
  return rows[a.length][b.length];
}

function exactRanges(value: string, term: string): Range[] {
  const { text, map } = compact(value);
  const ranges: Range[] = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf(term, from);
    if (at < 0) break;
    let end = map[at + term.length - 1] + 1;
    // Keep a decomposed accent (e.g. "e" + U+0301) inside the highlight with its letter.
    while (end < value.length && /\p{M}/u.test(value[end])) end++;
    ranges.push([map[at], end]);
    from = at + 1;
  }
  return ranges;
}

// Words in the value within the typo allowance of the term. A word may also match on its first
// term.length letters, so a half-typed word with a typo still finds the longer word.
function fuzzyRanges(value: string, term: string): { ranges: Range[]; distance: number } {
  const max = allowedTypos(term.length);
  const ranges: Range[] = [];
  let best = Infinity;
  if (max === 0) return { ranges, distance: best };
  for (const m of value.matchAll(WORD_RUN)) {
    const word = fold(m[0]);
    const start = m.index ?? 0;
    let d = typoDistance(term, word, max);
    if (d > max && word.length > term.length) d = typoDistance(term, word.slice(0, term.length), max);
    if (d <= max) {
      ranges.push([start, start + m[0].length]);
      best = Math.min(best, d);
    }
  }
  return { ranges, distance: best };
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

function matchItem<T>(item: T, fields: SearchField[], terms: string[], fuzzy: boolean): SearchResult<T> | null {
  const matches: Record<string, FieldMatch> = {};
  let score = 0;
  for (const term of terms) {
    let termMatched = false;
    let termBest = Infinity;
    for (const f of fields) {
      if (!f.value) continue;
      let ranges = exactRanges(f.value, term);
      let distance = ranges.length ? 0 : Infinity;
      if (!ranges.length && fuzzy) ({ ranges, distance } = fuzzyRanges(f.value, term));
      if (!ranges.length) continue;
      termMatched = true;
      termBest = Math.min(termBest, distance);
      const existing = matches[f.key];
      if (existing) existing.ranges = mergeRanges([...existing.ranges, ...ranges]);
      else matches[f.key] = { key: f.key, label: f.label, value: f.value, ranges: mergeRanges(ranges) };
    }
    if (!termMatched) return null;
    score += termBest;
  }
  return { item, matches, score };
}

export function searchItems<T>(
  items: T[],
  query: string,
  getFields: (item: T) => SearchField[],
): SearchOutcome<T> {
  const terms = queryTerms(query);
  if (terms.length === 0) {
    return { mode: "all", results: items.map((item) => ({ item, matches: {}, score: 0 })) };
  }
  const run = (fuzzy: boolean) =>
    items
      .map((item) => matchItem(item, getFields(item), terms, fuzzy))
      .filter((r): r is SearchResult<T> => r !== null);

  const exact = run(false);
  if (exact.length > 0) return { mode: "exact", results: exact };
  // Stable sort keeps the list's own order among equally close matches.
  const fuzzy = run(true).sort((a, b) => a.score - b.score);
  return { mode: "fuzzy", results: fuzzy };
}

// A window of `text` around its first highlighted range, with ranges shifted to match.
export function excerpt(text: string, ranges: Range[], before = 40, after = 80) {
  if (ranges.length === 0 || text.length <= before + after) return { text, ranges };
  const start = Math.max(0, ranges[0][0] - before);
  const end = Math.min(text.length, ranges[0][0] + after);
  const prefix = start > 0 ? "…" : "";
  const shift = prefix.length - start;
  return {
    text: prefix + text.slice(start, end) + (end < text.length ? "…" : ""),
    ranges: ranges
      .filter(([s, e]) => s >= start && e <= end)
      .map(([s, e]) => [s + shift, e + shift] as Range),
  };
}
