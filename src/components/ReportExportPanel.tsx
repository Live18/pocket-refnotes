import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import {
  fulfillReportExportRequest,
  listAllReportExportRequests,
  listMyReportExportRequests,
  requestReportExport,
} from "@/lib/admin.functions";
import { REPORT_CSV_HEADER, downloadCsv, reportCsvRow, toCsv } from "@/lib/report-export";

// "YYYY-MM-DD" → "9/27/2026" without any timezone shift (it's a calendar day, not an instant).
function formatDay(day: string | null) {
  if (!day) return null;
  const [y, m, d] = day.split("-").map(Number);
  return `${m}/${d}/${y}`;
}

function rangeLabel(r: { sent_from: string | null; sent_to: string | null }) {
  if (!r.sent_from && !r.sent_to) return "All sent reports";
  return `Sent ${formatDay(r.sent_from) ?? "…"} – ${formatDay(r.sent_to) ?? "…"}`;
}

// Bulk download of delivered reports as a spreadsheet. Same workflow as the activity log export:
// any admin requests a sent-date range; a super admin fulfills it (the CSV downloads in the
// super admin's browser, and the export is recorded in the activity log).
export function ReportExportPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const qc = useQueryClient();
  const listMine = useServerFn(listMyReportExportRequests);
  const listAll = useServerFn(listAllReportExportRequests);
  const submitRequest = useServerFn(requestReportExport);
  const fulfill = useServerFn(fulfillReportExportRequest);

  const [open, setOpen] = useState(false);
  const [sentFrom, setSentFrom] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [fulfillError, setFulfillError] = useState<string | null>(null);

  const mine = useQuery({ queryKey: ["report-export-requests"], queryFn: () => listMine() });
  const all = useQuery({
    queryKey: ["all-report-export-requests"],
    queryFn: () => listAll(),
    enabled: isSuperAdmin,
  });
  const pendingCount = isSuperAdmin ? (all.data?.requests ?? []).filter((r: any) => r.status === "pending").length : 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["report-export-requests"] });
    qc.invalidateQueries({ queryKey: ["all-report-export-requests"] });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSubmitted(false);
    try {
      await submitRequest({ data: { sentFrom: sentFrom || undefined, sentTo: sentTo || undefined } });
      setSentFrom("");
      setSentTo("");
      setSubmitted(true);
      refresh();
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleFulfill = async (requestId: string) => {
    setFulfillingId(requestId);
    setFulfillError(null);
    try {
      const result = await fulfill({ data: { requestId } });
      const csv = toCsv(REPORT_CSV_HEADER, result.reports.map(reportCsvRow));
      downloadCsv(`refnotes-reports-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      refresh();
    } catch (err: any) {
      setFulfillError(err?.message ?? "Something went wrong. Try again.");
    } finally {
      setFulfillingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-sm"
      >
        <span className="font-medium">Request download</span>
        <span className="text-xs text-muted-foreground">
          {pendingCount > 0 ? `${pendingCount} pending · ` : ""}
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-3">
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Request a spreadsheet of delivered reports by the date they were sent. Leave dates blank for all
              reports. A super admin generates the download.
            </p>
            <div className="flex gap-2">
              <label className="flex-1 space-y-1 text-xs text-muted-foreground">
                Sent from
                <input
                  type="date"
                  value={sentFrom}
                  max={sentTo || undefined}
                  onChange={(e) => setSentFrom(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="flex-1 space-y-1 text-xs text-muted-foreground">
                Sent to
                <input
                  type="date"
                  value={sentTo}
                  min={sentFrom || undefined}
                  onChange={(e) => setSentTo(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button disabled={busy} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
              {busy ? "Submitting…" : "Request download"}
            </button>
            {submitted && <p className="text-sm text-emerald-600">Request submitted.</p>}
          </form>

          {(mine.data?.requests ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Your requests</p>
              <ul className="space-y-2">
                {(mine.data?.requests ?? []).map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                    <div>
                      <p>{rangeLabel(r)}</p>
                      <p className="text-xs text-muted-foreground">requested {new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs ${r.status === "fulfilled" ? "text-foreground" : "opacity-70"}`}>
                      {r.status === "fulfilled" ? `fulfilled · ${r.report_count ?? 0} reports` : "pending"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isSuperAdmin && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">All download requests</p>
              {fulfillError && <p className="text-sm text-destructive">{fulfillError}</p>}
              {(all.data?.requests ?? []).length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
              <ul className="space-y-2">
                {(all.data?.requests ?? []).map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
                    <div className="min-w-0">
                      <p>{rangeLabel(r)}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.requester_name} · requested {new Date(r.created_at).toLocaleDateString()}
                        {r.status === "fulfilled" && r.fulfilled_at
                          ? ` · fulfilled ${new Date(r.fulfilled_at).toLocaleDateString()} (${r.report_count ?? 0} reports)`
                          : ""}
                      </p>
                    </div>
                    {r.status === "fulfilled" ? (
                      <span className="shrink-0 text-xs text-foreground">fulfilled</span>
                    ) : (
                      <button
                        disabled={fulfillingId === r.id}
                        onClick={() => handleFulfill(r.id)}
                        className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                      >
                        {fulfillingId === r.id ? "Generating…" : "Generate & Download"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
