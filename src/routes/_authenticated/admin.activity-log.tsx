import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import {
  listMyActivityLogRequests,
  requestActivityLogExport,
  listAllActivityLogRequests, // <-- ADDITION
  fulfillActivityLogRequest, // <-- ADDITION
} from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/activity-log")({
  component: ActivityLogRequestPage,
});

// <-- ADDITION: turns the rows returned by fulfillActivityLogRequest into a
// downloadable CSV string. Escapes commas/quotes/newlines per RFC 4180.
function toCsv(entries: any[]): string {
  const header = ["created_at", "actor", "action", "target_id", "metadata"];
  const escape = (val: unknown) => {
    const s = val === null || val === undefined ? "" : String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = entries.map((e) => {
    const actorLabel = e.actor?.display_name || e.actor?.email || e.actor_id || "";
    const createdAt = new Date(e.created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    return [createdAt, actorLabel, e.action, e.target_id ?? "", JSON.stringify(e.metadata ?? {})]
      .map(escape)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

// <-- ADDITION: triggers a browser download of the CSV via a Blob URL.
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ActivityLogRequestPage() {
  const { me } = useAuth();
  const list = useServerFn(listMyActivityLogRequests);
  const submitRequest = useServerFn(requestActivityLogExport);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-activity-log-requests"],
    queryFn: () => list(),
  });

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // <-- ADDITION: Super Admin fulfill-panel state/data, only used when the
  // section below actually renders.
  const listAll = useServerFn(listAllActivityLogRequests);
  const fulfill = useServerFn(fulfillActivityLogRequest);
  const isSuperAdmin = !!me && can(me.role, "activityLog:manage");
  const { data: allData } = useQuery({
    queryKey: ["admin-all-activity-log-requests"],
    queryFn: () => listAll(),
    enabled: isSuperAdmin,
  });
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [fulfillError, setFulfillError] = useState<string | null>(null);

  if (!me || !can(me.role, "users:manage")) {
    return <p className="text-sm text-muted-foreground">You don't have access to this page.</p>;
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-activity-log-requests"] });
  // <-- ADDITION
  const refreshAll = () => qc.invalidateQueries({ queryKey: ["admin-all-activity-log-requests"] });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSubmitted(false);
    try {
      await submitRequest({
        data: {
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        },
      });
      setStartDate("");
      setEndDate("");
      setSubmitted(true);
      refresh();
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // <-- ADDITION: fulfill one request — fetch rows, download CSV, mark fulfilled, refresh both lists.
  const handleFulfill = async (requestId: string) => {
    setFulfillingId(requestId);
    setFulfillError(null);
    try {
      const result = await fulfill({ data: { requestId } });
      const csv = toCsv(result.entries);
      downloadCsv(`activity-log-${requestId}.csv`, csv);
      refreshAll();
      refresh();
    } catch (err: any) {
      setFulfillError(err?.message ?? "Something went wrong. Try again.");
    } finally {
      setFulfillingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-card p-3">
        <p className="text-sm text-muted-foreground">
          Request an export of the activity log. Leave dates blank for the full log.
        </p>
        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button disabled={busy} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? "Submitting…" : "Request activity log"}
        </button>
        {submitted && <p className="text-sm text-emerald-600">Request submitted.</p>}
      </form>

      <ul className="space-y-2">
        {(data?.requests ?? []).map((r: any) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
            <div>
              <p>
                {r.date_range_start || r.date_range_end
                  ? `${r.date_range_start ? new Date(r.date_range_start).toLocaleDateString() : "…"} – ${r.date_range_end ? new Date(r.date_range_end).toLocaleDateString() : "…"}`
                  : "Full log"}
              </p>
              <p className="text-xs text-muted-foreground">
                requested {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`text-xs ${r.status === "fulfilled" ? "text-foreground" : "opacity-70"}`}>
              {r.status}
            </span>
          </li>
        ))}
      </ul>

      {/* <-- ADDITION: Super Admin fulfill panel, only rendered for super_admin */}
      {isSuperAdmin && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-medium">All requests</p>
          {fulfillError && <p className="text-sm text-destructive">{fulfillError}</p>}
          <ul className="space-y-2">
            {(allData?.requests ?? []).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <div>
                  <p>
                    {r.date_range_start || r.date_range_end
                      ? `${r.date_range_start ? new Date(r.date_range_start).toLocaleDateString() : "…"} – ${r.date_range_end ? new Date(r.date_range_end).toLocaleDateString() : "…"}`
                      : "Full log"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    requested {new Date(r.created_at).toLocaleDateString()}
                    {r.status === "fulfilled" && r.fulfilled_at
                      ? ` · fulfilled ${new Date(r.fulfilled_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                {r.status === "fulfilled" ? (
                  <span className="text-xs text-foreground">fulfilled</span>
                ) : (
                  <button
                    disabled={fulfillingId === r.id}
                    onClick={() => handleFulfill(r.id)}
                    className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
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
  );
}