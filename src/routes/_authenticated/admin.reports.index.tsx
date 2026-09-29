import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listDeliveredReports } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { isPreviewUserId } from "@/lib/preview-mode";
import { entryStatusLabel, searchItems, type SearchField } from "@/lib/report-search";
import { Highlight, MatchedFields, NoMatches, SearchBox } from "@/components/ReportSearch";
import { GameDetails, formatGameDate } from "@/components/GameDetails";

export const Route = createFileRoute("/_authenticated/admin/reports/")({
  component: ReportsPage,
});

type DeliveredReport = {
  id: string;
  author_id: string;
  author_name: string;
  recipient_email: string | null;
  sent_at: string;
  body: { text?: string } | null;
  game: {
    id: string;
    title: string;
    game_date: string | null;
    location: string | null;
    crew: string | null;
    level: string | null;
    gender: string | null;
    home_team: string | null;
    visiting_team: string | null;
  } | null;
};

// Same fields the referees' own Journal search covers, plus who filed the report.
function reportFields(r: DeliveredReport): SearchField[] {
  const g = r.game;
  return [
    { key: "title", label: "Title", value: g?.title ?? "Untitled game" },
    { key: "home", label: "Home", value: g?.home_team },
    { key: "visiting", label: "Visiting", value: g?.visiting_team },
    { key: "location", label: "Location", value: g?.location },
    { key: "crew", label: "Crew", value: g?.crew },
    { key: "level", label: "Level", value: g?.level },
    { key: "gender", label: "Gender", value: g?.gender },
    { key: "notes", label: "Notes", value: r.body?.text },
    { key: "status", label: "Status", value: entryStatusLabel("saved_sent") },
    { key: "author", label: "Filed by", value: r.author_name },
  ];
}

// Fields the card already shows — their matches are highlighted in place, not repeated below.
const ON_CARD = ["title", "level", "gender", "crew", "author"];

function ReportsPage() {
  const { me } = useAuth();
  const isPreview = isPreviewUserId(me?.userId);
  const list = useServerFn(listDeliveredReports);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-reports", isPreview],
    queryFn: isPreview ? async () => ({ reports: [] as DeliveredReport[] }) : () => list(),
  });

  const [query, setQuery] = useState("");
  const reports = (data?.reports ?? []) as DeliveredReport[];
  const search = useMemo(() => searchItems(reports, query, reportFields), [reports, query]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load reports."}</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Reports that were sent and delivered, newest first.</p>

      {reports.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No delivered reports yet.
        </p>
      )}

      {reports.length > 0 && (
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search reports — teams, referee, crew, notes…"
          mode={search.mode}
          shown={search.results.length}
          total={reports.length}
          noun="reports"
        />
      )}
      {reports.length > 0 && search.results.length === 0 && <NoMatches query={query} noun="reports" />}

      <ul className="space-y-2">
        {search.results.map(({ item: r, matches }) => (
          <li key={r.id}>
            <Link
              to="/admin/reports/$id"
              params={{ id: r.id }}
              className="block rounded-lg border border-border bg-card p-4 hover:scale-[1.02] transition"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-medium">
                  <Highlight text={r.game?.title ?? "Untitled game"} ranges={matches.title?.ranges} />
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">{formatGameDate(r.game?.game_date)}</span>
              </div>
              {r.game && <GameDetails game={r.game} matches={matches} />}
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="text-foreground/70">Filed by </span>
                <Highlight text={r.author_name} ranges={matches.author?.ranges} />
                {` · Sent ${formatGameDate(r.sent_at)}`}
              </p>
              <MatchedFields matches={matches} onCard={ON_CARD} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
