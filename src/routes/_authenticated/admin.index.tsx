import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMembers, changeRole } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { isPreviewUserId, previewMocks } from "@/lib/preview-mode";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: MembersPage,
});

function MembersPage() {
  const { me } = useAuth();
  const isPreview = isPreviewUserId(me?.userId);
  const list = useServerFn(listMembers);
  const change = useServerFn(changeRole);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-members", isPreview],
    queryFn: isPreview ? async () => ({ members: previewMocks.members }) : () => list(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const members = data?.members ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-members"] });

  return (
    <div className="space-y-3">
      {members.length === 0 && <p className="text-sm text-muted-foreground">No members yet. Invite someone to get started.</p>}
      {members.map((m: any) => (
        <div key={m.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{m.display_name ?? m.email ?? m.id}</p>
              <p className="text-xs text-muted-foreground">{m.email}</p>
              <p className="mt-1 text-xs">Role: <strong>{m.role || "—"}</strong></p>
            </div>
            <div className="flex gap-2">
              <select
                className="rounded border border-input bg-background px-2 py-1 text-xs"
                value={m.role ?? "user"}
                onChange={async (e) => { if (isPreview) return; await change({ data: { userId: m.id, role: e.target.value as any } }); refresh(); }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {m.lastEntry && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last report: {m.lastEntry.game?.title ?? "—"} ({m.lastEntry.status})
              {m.lastEntry.sent_at ? ` · sent ${new Date(m.lastEntry.sent_at).toLocaleDateString()}` : ""}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
