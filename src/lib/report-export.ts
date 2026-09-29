// Helpers for the bulk report export (admin Reports tab).

const PACIFIC = "America/Los_Angeles";

// UTC instant of 00:00 Pacific time on a YYYY-MM-DD calendar day (handles PST/PDT).
export function pacificStartOfDay(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: PACIFIC, hour: "numeric", hourCycle: "h23" });
  // Pacific midnight is 07:00 UTC (PDT) or 08:00 UTC (PST); pick whichever lands on hour 0.
  for (const utcHour of [7, 8]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, utcHour));
    if (Number(fmt.format(candidate)) === 0) return candidate;
  }
  return new Date(Date.UTC(y, m - 1, d, 8));
}

// Inclusive Pacific-day range → [start, endExclusive) instants for a sent_at filter.
export function pacificDayRange(from: string | null, to: string | null) {
  let endExclusive: Date | null = null;
  if (to) {
    const next = new Date(`${to}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    endExclusive = pacificStartOfDay(next.toISOString().slice(0, 10));
  }
  return { start: from ? pacificStartOfDay(from) : null, endExclusive };
}

export function formatPacific(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { timeZone: PACIFIC, dateStyle: "short", timeStyle: "short" });
}

// RFC 4180 CSV that opens cleanly in Excel and Google Sheets:
// - cells starting with = + - @ (or tab/CR) get a leading apostrophe so they're never run as formulas
// - quotes, commas, and any line break (\n or \r\n) are quoted
// - CRLF row endings and a UTF-8 byte-order mark so accented names (José) display correctly
export function toCsv(header: string[], rows: unknown[][]): string {
  const cell = (val: unknown) => {
    let s = val === null || val === undefined ? "" : String(val);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const REPORT_CSV_HEADER = [
  "Game date/time (Pacific)",
  "Title",
  "Home team",
  "Visiting team",
  "Level",
  "Gender",
  "Location",
  "Crew",
  "Filed by",
  "Filed by email",
  "Sent (Pacific)",
  "Sent to",
  "Notes",
];

export function reportCsvRow(r: any): unknown[] {
  const g = r.game ?? {};
  return [
    formatPacific(g.game_date),
    g.title,
    g.home_team,
    g.visiting_team,
    g.level,
    g.gender,
    g.location,
    g.crew,
    r.author_name,
    r.author_email,
    formatPacific(r.sent_at),
    r.recipient_email,
    r.body?.text,
  ];
}
