import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDeliveredReport } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { isPreviewUserId } from "@/lib/preview-mode";
import { formatGameDate } from "@/components/GameDetails";

export const Route = createFileRoute("/_authenticated/admin/reports/$id")({
  component: ReportDetail,
});

// Read-only: admins can view another referee's delivered report but never edit it.
function ReportDetail() {
  const { id } = Route.useParams();
  const { me } = useAuth();
  const isPreview = isPreviewUserId(me?.userId);
  const fetchReport = useServerFn(getDeliveredReport);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-report", id, isPreview],
    queryFn: isPreview ? async () => ({ report: null }) : () => fetchReport({ data: { id } }),
  });

  const back = (
    <Link to="/admin/reports" className="text-xs text-muted-foreground hover:text-foreground">
      ← All reports
    </Link>
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <div className="space-y-2">{back}<p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load report."}</p></div>;

  const r: any = data?.report;
  if (!r) {
    return (
      <div className="space-y-2">
        {back}
        <p className="text-sm text-muted-foreground">Report not found, or it hasn't been delivered yet.</p>
      </div>
    );
  }

  const g = r.game;
  const classification = [g?.level, g?.gender].filter(Boolean).join(" · ");
  const details: [string, string | null | undefined][] = [
    ["Date", formatGameDate(g?.game_date)],
    ["Location", g?.location],
    ["Classification", classification],
    ["Crew", g?.crew],
    ["Filed by", r.author_name],
    ["Sent to", r.recipient_email],
    ["Sent", formatGameDate(r.sent_at)],
  ];

  return (
    <div className="space-y-4">
      {back}
      <h2 className="text-xl font-bold">{g?.title ?? "Untitled game"}</h2>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {details
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
      </dl>

      <div>
        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Notes</p>
        <div className="whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 font-mono text-sm">
          {r.body?.text || "No notes."}
        </div>
      </div>
    </div>
  );
}
