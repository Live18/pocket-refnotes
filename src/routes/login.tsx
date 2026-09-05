import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: (s) => search.parse(s),
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, previewAs } = useAuth();
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) router.navigate({ to: redirect ?? "/" });
  }, [isAuthenticated, router, redirect]);

  // Shared by the post-signup send and the resend button on the "check your inbox" screen.
  const sendVerificationEmail = async (targetEmail: string) => {
    const { error: sendError } = await supabase.functions.invoke("send-verification-email", {
      body: { email: targetEmail },
    });
    return sendError;
  };

  // TODO: rate-limit login attempts.
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message === "Email not confirmed") {
            setAwaitingVerification(email);
            return;
          }
          throw error;
        }
      } else {
        const { error, data } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.user) {
          const sendError = await sendVerificationEmail(email);
          setAwaitingVerification(email);
          if (sendError) setError("We couldn't send the verification email. Try again below.");
        }
      }
    } catch (err: any) {
      setError(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!awaitingVerification) return;
    setResendBusy(true); setNotice(null); setError(null);
    try {
      const sendError = await sendVerificationEmail(awaitingVerification);
      if (sendError) setError("Couldn't resend the verification email. Try again.");
      else setNotice("Sent — check your inbox.");
    } finally {
      setResendBusy(false);
    }
  };

  const backToSignIn = () => {
    setAwaitingVerification(null);
    setError(null);
    setNotice(null);
    setMode("signin");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 py-8">
      {awaitingVerification ? (
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-semibold">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to <span className="text-foreground">{awaitingVerification}</span>.
            Click it to confirm your email, then come back and sign in.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-emerald-600">{notice}</p>}
          <button
            type="button"
            onClick={resendVerification}
            disabled={resendBusy}
            className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm hover:scale-105 active:scale-95 transition disabled:opacity-50"
          >
            {resendBusy ? "Sending…" : "Resend verification email"}
          </button>
          <button type="button" onClick={backToSignIn} className="w-full text-xs text-muted-foreground hover:text-foreground">
            Back to sign in
          </button>
        </div>
      ) : (
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:scale-105 active:scale-95 transition disabled:opacity-50">
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="w-full text-xs text-muted-foreground hover:text-foreground">
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Have an invite? <Link to="/" className="underline">Open the link from your email</Link>
        </p>
      </form>
      )}

      {import.meta.env.DEV && (
        <div className="mt-4 w-full max-w-sm space-y-2 rounded-xl border border-dashed border-border bg-muted/30 p-4">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Dev preview</p>
          <p className="text-xs text-muted-foreground">No real auth, no data is saved. Lets you click through the post-login screens.</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { previewAs("user"); router.navigate({ to: "/" }); }}
              className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:scale-105 active:scale-95 transition"
            >Preview as User</button>
            <button
              onClick={() => { previewAs("admin"); router.navigate({ to: "/" }); }}
              className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:scale-105 active:scale-95 transition"
            >Preview as Admin</button>
            <button
              onClick={() => { previewAs("super_admin"); router.navigate({ to: "/" }); }}
              className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:scale-105 active:scale-95 transition"
            >Preview as Super Admin</button>
          </div>
        </div>
      )}
    </div>
  );
}