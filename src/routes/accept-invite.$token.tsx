import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { acceptInvite, getInviteByToken } from "@/lib/invites.functions";

export const Route = createFileRoute("/accept-invite/$token")({
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const { session, refresh } = useAuth();
  const router = useRouter();
  const [invite, setInvite] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  useEffect(() => {
    getInviteByToken({ data: { token } }).then((res) => setInvite(res.invite)).catch(() => setInvite(null));
  }, [token]);

  const sendVerificationEmail = async (targetEmail: string) => {
    const { error: sendError } = await supabase.functions.invoke("send-verification-email", {
      body: { email: targetEmail },
    });
    return sendError;
  };

  const accept = async (e: FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setBusy(true); setError(null);
    try {
      if (!session) {
        const { error: suErr, data } = await supabase.auth.signUp({
          email: invite.email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/accept-invite/${token}` },
        });
        if (suErr) throw suErr;
        if (data.user) {
          const sendError = await sendVerificationEmail(invite.email);
          setAwaitingVerification(true);
          if (sendError) setError("We couldn't send the verification email. Try again below.");
        }
        return;
      }
      await acceptInvite({ data: { token } });
      await refresh();
      router.navigate({ to: "/" });
    } catch (err: any) {
      setError(err.message ?? "Could not accept invite");
    } finally {
      setBusy(false);
    }
  };

  if (invite === null) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading invite…</div>;
  }
  if (invite.accepted_at) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">This invite has already been used.</div>;
  }

  if (awaitingVerification) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to <span className="text-foreground">{invite.email}</span>.
            Click it, then come back to this page to finish joining.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={accept} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Join {invite.org?.name ?? "the team"}</h1>
        <p className="text-sm text-muted-foreground">
          You were invited as <strong>{invite.role}</strong> using <strong>{invite.email}</strong>.
        </p>
        {!session && (
          <input
            type="password" required minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose a password"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:scale-105 active:scale-95 transition disabled:opacity-50">
          {busy ? "…" : "Accept invite"}
        </button>
      </form>
    </div>
  );
}