import { createFileRoute, useRouter } from "@tanstack/react-router"; // <-- CHANGE: dropped unused Link import — its only usage (the invite line) was removed
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
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.navigate({ to: redirect ?? "/" });
  }, [isAuthenticated, router, redirect]);

  const sendVerificationEmail = async (targetEmail: string) => {
    const { error: sendError } = await supabase.functions.invoke("send-verification-email", {
      body: { email: targetEmail },
    });
    return sendError;
  };

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

  const requestPasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setResetBusy(true); setError(null);
    try {
      const { error: sendError } = await supabase.functions.invoke("send-password-reset", {
        body: { email, redirectTo: `${window.location.origin}/reset-password` },
      });
      if (sendError) throw sendError;
      setResetSent(email);
    } catch (err: any) {
      setError(err.message ?? "Couldn't send the reset email");
    } finally {
      setResetBusy(false);
    }
  };

  const backToSignIn = () => {
    setAwaitingVerification(null);
    setResetSent(null);
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
      ) : resetSent ? (
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-semibold">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            We sent a password reset link to <span className="text-foreground">{resetSent}</span>.
            Click it to choose a new password.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="button" onClick={backToSignIn} className="w-full text-xs text-muted-foreground hover:text-foreground">
            Back to sign in
          </button>
        </div>
      ) : mode === "forgot" ? (
        <form onSubmit={requestPasswordReset} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
          <h1 className="text-2xl font-semibold">Reset your password</h1>
          <p className="text-sm text-muted-foreground">Enter your email and we'll send you a link to set a new password.</p>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={resetBusy} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:scale-105 active:scale-95 transition disabled:opacity-50">
            {resetBusy ? "Sending…" : "Send reset link"}
          </button>
          <button type="button" onClick={backToSignIn} className="w-full text-xs text-muted-foreground hover:text-foreground">
            Back to sign in
          </button>
        </form>
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
        {/* <-- REMOVED: the under-password "Forgot password?" button that used to live here */}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:scale-105 active:scale-95 transition disabled:opacity-50">
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="w-full text-xs text-muted-foreground hover:text-foreground">
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
        {/* <-- CHANGE: replaced the "Have an invite?" line entirely — this is now
             where the forgot-password entry point lives, only shown in signin mode
             since signup doesn't need it */}
        {mode === "signin" && (
          <p className="text-center text-xs text-muted-foreground">
            Forgot password?{" "}
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}
              className="underline"
            >
              Click here
            </button>
          </p>
        )}
      </form>
      )}
    </div>
  );
}