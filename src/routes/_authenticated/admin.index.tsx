import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listMembers, changeRole } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { isPreviewUserId, previewMocks } from "@/lib/preview-mode";
import { can } from "@/lib/permissions";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: MembersPage,
});

interface PendingRoleChange {
  userId: string;
  name: string;
  fromRole: string;
  toRole: "user" | "admin";
}

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

  const [pending, setPending] = useState<PendingRoleChange | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me || !can(me.role, "users:manage")) {
    return <p className="text-sm text-muted-foreground">You don't have access to this page.</p>;
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const members = data?.members ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-members"] });

  const requestRoleChange = (m: any, toRole: "user" | "admin") => {
    if (isPreview || toRole === m.role) return;
    setError(null);
    setPending({
      userId: m.id,
      name: m.display_name ?? m.email ?? m.id,
      fromRole: m.role ?? "user",
      toRole,
    });
  };

  const confirmRoleChange = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await change({ data: { userId: pending.userId, role: pending.toRole } });
      setPending(null);
      refresh();
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong changing this role. Try again.");
    } finally {
      setBusy(false);
    }
  };

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
              {m.role === "super_admin" ? (
                <span className="rounded border border-input bg-muted px-2 py-1 text-xs text-muted-foreground">
                  Super Admin
                </span>
              ) : (
                <select
                  className="rounded border border-input bg-background px-2 py-1 text-xs"
                  value={m.role ?? "user"}
                  onChange={(e) => requestRoleChange(m, e.target.value as "user" | "admin")}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              )}
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

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) { setPending(null); setError(null); } }}
        title={pending ? `Change ${pending.name}'s role?` : ""}
        description={
          pending
            ? `This changes ${pending.name} from ${pending.fromRole} to ${pending.toRole}. They'll immediately gain or lose admin access.`
            : ""
        }
        confirmLabel="Change role"
        busy={busy}
        error={error}
        onConfirm={confirmRoleChange}
      />
    </div>
  );
}
