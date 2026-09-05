import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { listInvites, inviteMember, revokeInvite } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { isPreviewUserId, previewMocks } from "@/lib/preview-mode";
import { can } from "@/lib/permissions";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/admin/invites")({
  component: InvitesPage,
});

type PendingAction =
  | { type: "invite"; email: string; role: "admin" | "user" }
  | { type: "revoke"; inviteId: string; email: string };

function InvitesPage() {
  const { me } = useAuth();
  const isPreview = isPreviewUserId(me?.userId);
  const list = useServerFn(listInvites);
  const invite = useServerFn(inviteMember);
  const revoke = useServerFn(revokeInvite);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-invites", isPreview],
    queryFn: isPreview ? async () => ({ invites: previewMocks.invites }) : () => list(),
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me || !can(me.role, "users:manage")) {
    return <p className="text-sm text-muted-foreground">You don't have access to this page.</p>;
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-invites"] });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (isPreview) {
      setLastUrl(`${window.location.origin}/accept-invite/preview-token-${Date.now()}`);
      setEmail("");
      return;
    }
    setError(null);
    setPending({ type: "invite", email, role });
  };

  const requestRevoke = (inviteId: string, inviteEmail: string) => {
    if (isPreview) return;
    setError(null);
    setPending({ type: "revoke", inviteId, email: inviteEmail });
  };

  const confirmPending = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.type === "invite") {
        const res = await invite({ data: { email: pending.email, role: pending.role } });
        setEmail("");
        setLastUrl(window.location.origin + res.inviteUrl);
      } else {
        await revoke({ data: { id: pending.inviteId } });
      }
      setPending(null);
      refresh();
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex gap-2 rounded-lg border border-border bg-card p-3">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "user")} className="rounded-md border border-input bg-background px-2 text-sm">
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
          Invite
        </button>
      </form>

      {lastUrl && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
          <p className="text-muted-foreground">Invite link (copy & send manually until email worker is wired):</p>
          <code className="mt-1 block break-all text-foreground">{lastUrl}</code>
        </div>
      )}

      <ul className="space-y-2">
        {(data?.invites ?? []).map((iv: any) => (
          <li key={iv.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
            <div>
              <p>{iv.email} <span className="text-xs text-muted-foreground">({iv.role})</span></p>
              <p className="text-xs text-muted-foreground">
                {iv.accepted_at ? "accepted" : `expires ${new Date(iv.expires_at).toLocaleDateString()}`}
              </p>
            </div>
            {!iv.accepted_at && (
              <button
                onClick={() => requestRevoke(iv.id, iv.email)}
                className="text-xs text-destructive underline"
              >Revoke</button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) { setPending(null); setError(null); } }}
        title={
          pending?.type === "invite"
            ? `Invite ${pending.email}?`
            : pending?.type === "revoke"
              ? `Revoke invite for ${pending.email}?`
              : ""
        }
        description={
          pending?.type === "invite"
            ? `They'll be invited as ${pending.role === "admin" ? "an Admin" : "a User"}. You'll get a link to send them manually.`
            : pending?.type === "revoke"
              ? "This invite link will stop working immediately."
              : ""
        }
        confirmLabel={pending?.type === "revoke" ? "Revoke invite" : "Send invite"}
        destructive={pending?.type === "revoke"}
        busy={busy}
        error={error}
        onConfirm={confirmPending}
      />
    </div>
  );
}
