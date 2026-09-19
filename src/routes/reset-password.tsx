import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

// How long to wait for a PASSWORD_RECOVERY confirmation once we've seen
// recovery evidence in the URL. Not based on measured timing — chosen as
// "generous enough for local token verification to finish."
const RECOVERY_WAIT_MS = 3000;
// Much shorter grace period when there's no recovery evidence in the URL at
// all (e.g. someone navigated here directly) — nothing to wait for.
const NO_EVIDENCE_WAIT_MS = 300;

type Stage = "checking" | "ready" | "invalid" | "success";

function ResetPasswordPage() {
  const router = useRouter();

  // <-- ADDITION: read synchronously during this component's first render —
  // before Supabase's async initialize() can resolve and strip the hash via
  // history.replaceState(). This replaces the getSession() fallback from the
  // earlier draft: getSession() couldn't tell a genuine new recovery session
  // apart from an unrelated pre-existing one already in the browser. This
  // reads what the URL itself actually carried, tying the decision to real
  // evidence instead of ambient session state.
  const [hasRecoveryEvidence] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.hash.includes("type=recovery");
  });

  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<Stage>("checking"); // <-- ADDITION: lets the unmount cleanup below read the latest stage

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    // GoTrue redirects failed/expired verifications back here as query
    // params, not a hash — check that first, nothing to wait for.
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") || params.get("error_code")) {
      setStage("invalid");
      return;
    }

    // Subscribe FIRST, same reasoning as auth-context.tsx: the client can
    // fire PASSWORD_RECOVERY before this effect runs. Subscribing first
    // narrows, but doesn't close, that window — the hash check above and the
    // timeout below are the rest of the safety net.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStage("ready");
      }
    });

    const timeout = setTimeout(() => {
      setStage((s) => (s === "checking" ? "invalid" : s));
    }, hasRecoveryEvidence ? RECOVERY_WAIT_MS : NO_EVIDENCE_WAIT_MS); // <-- CHANGE: shorter timeout when the URL never carried recovery evidence to begin with

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [hasRecoveryEvidence]);

  // <-- ADDITION: if a real recovery session was confirmed (stage reached
  // "ready") but the person navigates away or closes the tab without
  // finishing — never reaching "success" — sign them out on unmount.
  // auth-attacher.ts confirmed a recovery session authenticates every
  // server-function call the app makes, exactly like a normal login, so an
  // abandoned flow left active is a real exposure on a shared device, not
  // just a loose end.
  useEffect(() => {
    return () => {
      if (stageRef.current === "ready") {
        supabase.auth.signOut();
      }
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStage("success");
      setTimeout(() => router.navigate({ to: "/" }), 2000);
    } catch (err: any) {
      setError(err.message ?? "Couldn't update your password");
    } finally {
      setBusy(false);
    }
  };

  if (stage === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Verifying your link…
      </div>
    );
  }

  if (stage === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold">Link no longer valid</h1>
          <p className="text-sm text-muted-foreground">
            This password reset link has expired or was already used. Request a new one from the sign-in page.
          </p>
          <button
            type="button"
            onClick={() => router.navigate({ to: "/login" })}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:scale-105 active:scale-95 transition"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  if (stage === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold">Password updated</h1>
          <p className="text-sm text-muted-foreground">Taking you back to RefNotes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <input
          type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:scale-105 active:scale-95 transition disabled:opacity-50">
          {busy ? "…" : "Update password"}
        </button>
      </form>
    </div>
  );
}