import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { listInvites, inviteMember, revokeInvite } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/invites")({
  component: InvitesPage,
});

function InvitesPage() {
  const list = useServerFn(listInvites);
  const invite = useServerFn(inviteMember);
  const revoke = useServerFn(revokeInvite);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-invites"], queryFn: () => list() });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-invites"] });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await invite({ data: { email, role } });
      setEmail("");
      setLastUrl(window.location.origin + res.inviteUrl);
      refresh();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex gap-2 rounded-lg border border-border bg-card p-3">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as any)} className="rounded-md border border-input bg-background px-2 text-sm">
          <option value="member">member</option>
          <option value="admin">admin</option>
        </select>
        <button disabled={busy} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? "…" : "Invite"}
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
                onClick={async () => { await revoke({ data: { id: iv.id } }); refresh(); }}
                className="text-xs text-destructive underline"
              >Revoke</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
